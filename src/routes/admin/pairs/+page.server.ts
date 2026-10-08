import { fail } from '@sveltejs/kit';
import { and, desc, eq, sql } from 'drizzle-orm';
import { mediaUrl, versionOf } from '#lib/media.ts';
import { db } from '#lib/server/db/app.ts';
import { files, pairCandidates, photos, sources } from '#lib/server/db/schema.ts';
import { attachEdit, detachEdit } from '#lib/server/pairing.ts';
import { enqueuePairAll } from '#lib/server/queue.ts';
import type { Actions, PageServerLoad } from './$types';

type Thumb = {
	id: string;
	filename: string;
	relPath: string;
	thumb: string;
	source: string;
	takenAt: string | null;
	camera: string | null;
};

async function thumbOf(id: string): Promise<Thumb | null> {
	const [f] = await db()
		.select({
			id: files.id,
			filename: files.filename,
			relPath: files.relPathNfc,
			contentHash: files.contentHash,
			rotation: files.rotation,
			takenAt: files.takenAt,
			camera: files.cameraModel,
			source: sources.name
		})
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(eq(files.id, id))
		.limit(1);
	if (!f) return null;
	return {
		id: f.id,
		filename: f.filename,
		relPath: f.relPath,
		thumb: mediaUrl(f.id, 'thumb', versionOf(f.contentHash, f.rotation)),
		source: f.source,
		takenAt: f.takenAt ? f.takenAt.toISOString() : null,
		camera: f.camera
	};
}

export const load: PageServerLoad = async () => {
	const d = db();
	// 검토 큐
	const cands = await d
		.select()
		.from(pairCandidates)
		.where(eq(pairCandidates.rejected, false))
		.orderBy(desc(pairCandidates.score));
	const review = [];
	for (const c of cands) {
		const edit = await thumbOf(c.editFileId);
		const original = await thumbOf(c.originalFileId);
		if (edit && original) review.push({ edit, original, score: c.score, method: c.method });
	}
	// 최근 자동 페어링 (미확정)
	const autoRows = await d
		.select({
			photoId: photos.id,
			editId: files.id,
			originalId: photos.originalFileId,
			score: photos.pairConfidence,
			method: photos.pairMethod
		})
		.from(photos)
		.innerJoin(files, and(eq(files.photoId, photos.id), eq(files.variantRole, 'edit')))
		.where(
			and(
				eq(photos.pairConfirmed, false),
				sql`${photos.originalFileId} is not null`,
				sql`${photos.pairMethod} is not null`
			)
		)
		.orderBy(desc(photos.updatedAt))
		.limit(60);
	const auto = [];
	for (const r of autoRows) {
		const edit = await thumbOf(r.editId);
		const original = r.originalId ? await thumbOf(r.originalId) : null;
		if (edit && original)
			auto.push({ photoId: r.photoId, edit, original, score: r.score, method: r.method });
	}
	// 미페어링 보정본
	const unpairedRows = await d
		.select({ id: files.id })
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.innerJoin(photos, eq(photos.id, files.photoId))
		.where(
			and(
				eq(sources.role, 'edit'),
				eq(files.status, 'active'),
				sql`${photos.originalFileId} is null`
			)
		)
		.limit(200);
	const unpaired = [];
	for (const r of unpairedRows) {
		const t = await thumbOf(r.id);
		if (t) unpaired.push(t);
	}
	const [{ n: pairedCount }] = await d
		.select({ n: sql<number>`count(*)::int` })
		.from(photos)
		.where(
			sql`${photos.originalFileId} is not null and exists (select 1 from ${files} f where f.photo_id = ${photos.id} and f.variant_role = 'edit')`
		);
	const [orig] = await d
		.select({
			total: sql<number>`count(*)::int`,
			ready: sql<number>`count(*) filter (where ${files.derivativesReady})::int`,
			failed: sql<number>`count(*) filter (where ${files.processError} is not null)::int`,
			missing: sql<number>`count(*) filter (where ${files.status} = 'missing')::int`
		})
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(eq(sources.role, 'original'));
	return {
		review,
		auto,
		unpaired,
		pairedCount: Number(pairedCount),
		originals: {
			total: Number(orig.total),
			ready: Number(orig.ready),
			failed: Number(orig.failed),
			missing: Number(orig.missing)
		}
	};
};

export const actions: Actions = {
	confirm: async ({ request }) => {
		const form = await request.formData();
		const editId = String(form.get('editId') ?? '');
		const originalId = String(form.get('originalId') ?? '');
		if (!editId || !originalId) return fail(400, { error: 'ids' });
		await attachEdit(db(), editId, originalId, 'manual', 1, true);
		return { ok: '연결했습니다' };
	},
	reject: async ({ request }) => {
		const form = await request.formData();
		const editId = String(form.get('editId') ?? '');
		if (!editId) return fail(400, { error: 'id' });
		await db()
			.update(pairCandidates)
			.set({ rejected: true, updatedAt: new Date() })
			.where(eq(pairCandidates.editFileId, editId));
		return { ok: '후보를 거부했습니다' };
	},
	accept: async ({ request }) => {
		const form = await request.formData();
		const photoId = String(form.get('photoId') ?? '');
		if (!photoId) return fail(400, { error: 'id' });
		await db()
			.update(photos)
			.set({ pairConfirmed: true, updatedAt: new Date() })
			.where(eq(photos.id, photoId));
		return { ok: '확정했습니다' };
	},
	unpair: async ({ request }) => {
		const form = await request.formData();
		const editId = String(form.get('editId') ?? '');
		if (!editId) return fail(400, { error: 'id' });
		await detachEdit(db(), editId);
		return { ok: '연결을 풀었습니다' };
	},
	manual: async ({ request }) => {
		const form = await request.formData();
		const editId = String(form.get('editId') ?? '');
		const query = String(form.get('query') ?? '').trim();
		if (!editId || !query) return fail(400, { error: '파일명을 입력하세요' });
		const [orig] = await db()
			.select({ id: files.id })
			.from(files)
			.innerJoin(sources, eq(sources.id, files.sourceId))
			.where(and(eq(sources.role, 'original'), sql`${files.filename} ilike ${'%' + query + '%'}`))
			.limit(2);
		if (!orig) return fail(404, { error: `'${query}' 에 맞는 원본이 없습니다` });
		await attachEdit(db(), editId, orig.id, 'manual', 1, true);
		return { ok: '연결했습니다' };
	},
	rerun: async () => {
		await enqueuePairAll();
		return { ok: '미페어링 보정본 전체를 다시 페어링합니다 (워커 로그 참고)' };
	}
};
