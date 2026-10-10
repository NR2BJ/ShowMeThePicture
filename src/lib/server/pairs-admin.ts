// 페어링 관리: 탭별 키셋 페이지(무한 스크롤)와 한 건 조작. /admin/pairs 의 load 와 /api/admin/pairs 가 같이 쓴다.
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { mediaUrl, versionOf } from '#lib/media.ts';
import type { PairListItem, PairPage, PairTab, Thumb } from '#lib/pairs.ts';
import type { Db } from './db';
import { files, pairCandidates, photos, sources } from './db/schema';
import { attachEdit, detachEdit } from './pairing';

export const PAIR_PAGE = 60;

/** 파일 여러 개의 썸네일 정보를 한 번에 */
export async function thumbsFor(db: Db, ids: string[]): Promise<Map<string, Thumb>> {
	const out = new Map<string, Thumb>();
	const uniq = [...new Set(ids)];
	if (uniq.length === 0) return out;
	const rows = await db
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
		.where(inArray(files.id, uniq));
	for (const f of rows) {
		const v = versionOf(f.contentHash, f.rotation);
		out.set(f.id, {
			id: f.id,
			filename: f.filename,
			relPath: f.relPath,
			thumb: mediaUrl(f.id, 'thumb', v),
			preview: mediaUrl(f.id, 'preview', v),
			source: f.source,
			takenAt: f.takenAt ? f.takenAt.toISOString() : null,
			camera: f.camera
		});
	}
	return out;
}

const n = sql<number>`count(*)::int`;

export async function pairCounts(db: Db): Promise<Record<PairTab, number>> {
	const [[rv], [au], [cf], [un]] = await Promise.all([
		db.select({ n }).from(pairCandidates).where(eq(pairCandidates.rejected, false)),
		db
			.select({ n })
			.from(files)
			.innerJoin(photos, eq(photos.id, files.photoId))
			.where(
				and(
					eq(files.variantRole, 'edit'),
					eq(files.status, 'active'),
					eq(photos.pairConfirmed, false),
					isNotNull(photos.originalFileId),
					isNotNull(photos.pairMethod)
				)
			),
		db
			.select({ n })
			.from(files)
			.innerJoin(photos, eq(photos.id, files.photoId))
			.where(
				and(
					eq(files.variantRole, 'edit'),
					eq(files.status, 'active'),
					eq(photos.pairConfirmed, true),
					isNotNull(photos.originalFileId)
				)
			),
		db
			.select({ n })
			.from(files)
			.innerJoin(sources, eq(sources.id, files.sourceId))
			.innerJoin(photos, eq(photos.id, files.photoId))
			.where(
				and(eq(sources.role, 'edit'), eq(files.status, 'active'), isNull(photos.originalFileId))
			)
	]);
	return {
		review: Number(rv?.n ?? 0),
		auto: Number(au?.n ?? 0),
		confirmed: Number(cf?.n ?? 0),
		unpaired: Number(un?.n ?? 0)
	};
}

/** 탭의 한 페이지. cursor 는 직전 페이지 마지막 항목의 cursor. */
export async function listPairTab(
	db: Db,
	tab: PairTab,
	cursor: string | null,
	limit = PAIR_PAGE
): Promise<PairPage> {
	if (tab === 'review') {
		const conds = [eq(pairCandidates.rejected, false)];
		const c = cursor?.split('|');
		// score 는 real 이라 같은 타입으로 비교해야 같은 행이 다시 안 나온다
		if (c && c.length === 2 && Number.isFinite(Number(c[0])))
			conds.push(
				sql`(${pairCandidates.score}, ${pairCandidates.editFileId}) < (${Number(c[0])}::real, ${c[1]})`
			);
		const rows = await db
			.select()
			.from(pairCandidates)
			.where(and(...conds))
			.orderBy(desc(pairCandidates.score), desc(pairCandidates.editFileId))
			.limit(limit + 1);
		const page = rows.slice(0, limit);
		const th = await thumbsFor(
			db,
			page.flatMap((r) => [r.editFileId, r.originalFileId])
		);
		const items: PairListItem[] = [];
		for (const r of page) {
			const edit = th.get(r.editFileId);
			const original = th.get(r.originalFileId);
			if (edit && original)
				items.push({
					kind: 'review',
					edit,
					original,
					score: r.score,
					method: r.method,
					cursor: `${r.score}|${r.editFileId}`
				});
		}
		const last = page[page.length - 1];
		return {
			items,
			nextCursor: rows.length > limit && last ? `${last.score}|${last.editFileId}` : null
		};
	}
	if (tab === 'unpaired') {
		const conds = [
			eq(sources.role, 'edit'),
			eq(files.status, 'active'),
			isNull(photos.originalFileId)
		];
		if (cursor) conds.push(sql`${files.id} < ${cursor}`);
		const rows = await db
			.select({ id: files.id })
			.from(files)
			.innerJoin(sources, eq(sources.id, files.sourceId))
			.innerJoin(photos, eq(photos.id, files.photoId))
			.where(and(...conds))
			.orderBy(desc(files.id))
			.limit(limit + 1);
		const page = rows.slice(0, limit);
		const th = await thumbsFor(
			db,
			page.map((r) => r.id)
		);
		const items: PairListItem[] = [];
		for (const r of page) {
			const edit = th.get(r.id);
			if (edit) items.push({ kind: 'unpaired', edit, cursor: r.id });
		}
		const last = page[page.length - 1];
		return { items, nextCursor: rows.length > limit && last ? last.id : null };
	}
	// auto | confirmed: 보정 파일 한 장이 한 항목 (한 사진에 보정본이 여럿이면 각각 풀 수 있게)
	const conds = [
		eq(files.variantRole, 'edit'),
		eq(files.status, 'active'),
		isNotNull(photos.originalFileId),
		eq(photos.pairConfirmed, tab === 'confirmed')
	];
	if (tab === 'auto') conds.push(isNotNull(photos.pairMethod));
	const c = cursor?.split('|');
	if (c && c.length === 2)
		conds.push(sql`(${photos.updatedAt}, ${files.id}) < (${c[0]}::timestamptz, ${c[1]})`);
	const rows = await db
		.select({
			photoId: photos.id,
			editId: files.id,
			originalId: photos.originalFileId,
			score: photos.pairConfidence,
			method: photos.pairMethod,
			confirmed: photos.pairConfirmed,
			updatedAt: photos.updatedAt
		})
		.from(files)
		.innerJoin(photos, eq(photos.id, files.photoId))
		.where(and(...conds))
		.orderBy(desc(photos.updatedAt), desc(files.id))
		.limit(limit + 1);
	const page = rows.slice(0, limit);
	const th = await thumbsFor(
		db,
		page.flatMap((r) => [r.editId, r.originalId!])
	);
	const items: PairListItem[] = [];
	for (const r of page) {
		const edit = th.get(r.editId);
		const original = r.originalId ? th.get(r.originalId) : undefined;
		if (edit && original)
			items.push({
				kind: 'pair',
				photoId: r.photoId,
				edit,
				original,
				score: r.score,
				method: r.method,
				confirmed: r.confirmed,
				cursor: `${r.updatedAt.toISOString()}|${r.editId}`
			});
	}
	const last = page[page.length - 1];
	return {
		items,
		nextCursor:
			rows.length > limit && last ? `${last.updatedAt.toISOString()}|${last.editId}` : null
	};
}

/** 수동 연결 자동완성: 파일명 일부로 원본 파일을 찾는다 (처리 끝난 것만 — 썸네일이 있어야 고를 수 있다). */
export async function searchOriginals(db: Db, q: string, limit = 12): Promise<Thumb[]> {
	const needle = q.trim();
	if (!needle) return [];
	const rows = await db
		.select({ id: files.id })
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(
			and(
				eq(sources.role, 'original'),
				eq(files.status, 'active'),
				eq(files.derivativesReady, true),
				sql`${files.filename} ilike ${'%' + needle.replace(/[%_]/g, (c) => '\\' + c) + '%'}`
			)
		)
		.orderBy(files.filename, files.relPath)
		.limit(Math.min(50, Math.max(1, limit)));
	const th = await thumbsFor(
		db,
		rows.map((r) => r.id)
	);
	return rows.map((r) => th.get(r.id)).filter((t): t is Thumb => !!t);
}

export type PairAction =
	| { action: 'confirmCandidate'; editId: string; originalId: string }
	| { action: 'rejectCandidate'; editId: string; originalId: string }
	| { action: 'accept'; photoId: string }
	| { action: 'unconfirm'; photoId: string }
	| { action: 'unpair'; editId: string }
	| { action: 'manual'; editId: string; originalId?: string; query?: string };

export type PairActionResult =
	{ ok: true; message: string } | { ok: false; status: number; error: string };

const bad = (error: string, status = 400): PairActionResult => ({ ok: false, status, error });
const ok = (message: string): PairActionResult => ({ ok: true, message });

export async function runPairAction(db: Db, a: PairAction): Promise<PairActionResult> {
	switch (a.action) {
		case 'confirmCandidate': {
			if (!a.editId || !a.originalId) return bad('ids');
			const photoId = await attachEdit(db, a.editId, a.originalId, 'manual', 1, true);
			if (!photoId) return bad('원본 파일을 찾을 수 없습니다', 404);
			// 같은 보정본의 다른 후보는 더 볼 필요 없다
			await db.delete(pairCandidates).where(eq(pairCandidates.editFileId, a.editId));
			return ok('연결했습니다');
		}
		case 'rejectCandidate': {
			if (!a.editId || !a.originalId) return bad('ids');
			await db
				.update(pairCandidates)
				.set({ rejected: true, updatedAt: new Date() })
				.where(
					and(
						eq(pairCandidates.editFileId, a.editId),
						eq(pairCandidates.originalFileId, a.originalId)
					)
				);
			return ok('후보를 거부했습니다');
		}
		case 'accept':
		case 'unconfirm': {
			if (!a.photoId) return bad('id');
			await db
				.update(photos)
				.set({ pairConfirmed: a.action === 'accept', updatedAt: new Date() })
				.where(eq(photos.id, a.photoId));
			return ok(a.action === 'accept' ? '확정했습니다' : '확정을 취소했습니다 (연결은 그대로)');
		}
		case 'unpair': {
			if (!a.editId) return bad('id');
			await detachEdit(db, a.editId);
			return ok('연결을 풀었습니다');
		}
		case 'manual': {
			if (!a.editId) return bad('id');
			// 자동완성에서 고른 원본
			if (a.originalId) {
				const [o] = await db
					.select({ id: files.id, filename: files.filename })
					.from(files)
					.innerJoin(sources, eq(sources.id, files.sourceId))
					.where(and(eq(files.id, a.originalId), eq(sources.role, 'original')))
					.limit(1);
				if (!o) return bad('원본 파일을 찾을 수 없습니다', 404);
				const photoId = await attachEdit(db, a.editId, o.id, 'manual', 1, true);
				if (!photoId) return bad('연결할 수 없습니다', 409);
				return ok(`${o.filename} 에 연결했습니다`);
			}
			const query = (a.query ?? '').trim();
			if (!query) return bad('파일명을 입력하세요');
			const found = await db
				.select({ id: files.id, filename: files.filename })
				.from(files)
				.innerJoin(sources, eq(sources.id, files.sourceId))
				.where(and(eq(sources.role, 'original'), sql`${files.filename} ilike ${'%' + query + '%'}`))
				.limit(2);
			if (found.length === 0) return bad(`'${query}' 에 맞는 원본이 없습니다`, 404);
			if (found.length > 1)
				return bad(`'${query}' 에 맞는 원본이 여러 개입니다. 더 정확히 적어 주세요`);
			const photoId = await attachEdit(db, a.editId, found[0].id, 'manual', 1, true);
			if (!photoId) return bad('연결할 수 없습니다', 409);
			return ok(`${found[0].filename} 에 연결했습니다`);
		}
		default:
			return bad('unknown action');
	}
}

/** 자동으로 묶였지만 미확정인 것 전부 확정 */
export async function acceptAllPairs(db: Db): Promise<number> {
	const r = await db
		.update(photos)
		.set({ pairConfirmed: true, updatedAt: new Date() })
		.where(
			and(
				eq(photos.pairConfirmed, false),
				isNotNull(photos.originalFileId),
				sql`exists (select 1 from ${files} f where f.photo_id = ${photos.id} and f.variant_role = 'edit')`
			)
		)
		.returning({ id: photos.id });
	return r.length;
}

/** 확정 전부 취소 (연결은 유지, 미확정으로) — 일괄 확정을 잘못 눌렀을 때 */
export async function unconfirmAllPairs(db: Db): Promise<number> {
	const r = await db
		.update(photos)
		.set({ pairConfirmed: false, updatedAt: new Date() })
		.where(and(eq(photos.pairConfirmed, true), isNotNull(photos.originalFileId)))
		.returning({ id: photos.id });
	return r.length;
}

/** 원본 라이브러리 처리 현황 (페어링은 처리된 원본만 후보로 잡는다) */
export async function originalsStats(
	db: Db
): Promise<{ total: number; ready: number; failed: number; missing: number }> {
	const [o] = await db
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
		total: Number(o?.total ?? 0),
		ready: Number(o?.ready ?? 0),
		failed: Number(o?.failed ?? 0),
		missing: Number(o?.missing ?? 0)
	};
}
