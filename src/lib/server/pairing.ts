// 원본 ↔ 보정 페어링 (docs/DESIGN.md §3.3).
// 보정 파일 하나에 대해 원본 후보를 모으고 점수를 매겨 자동 연결 / 검토 큐 / 미페어링을 가른다.
import path from 'node:path';
import { and, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { Db } from './db';
import { files, pairCandidates, photos, sources } from './db/schema';

export type PairFile = {
	id: string;
	stemNorm: string;
	takenAt: Date | null;
	takenAtSource: string | null;
	cameraModel: string | null;
	phash: Uint8Array | null;
	photoId: string | null;
	relPath: string;
};

export const AUTO_THRESHOLD = 0.8;
export const REVIEW_THRESHOLD = 0.5;

export function hamming(a: Uint8Array, b: Uint8Array): number {
	let d = 0;
	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		let x = a[i] ^ b[i];
		while (x) {
			d += x & 1;
			x >>= 1;
		}
	}
	return d;
}

export type ScoreParts = {
	stem: number;
	time: number;
	camera: number;
	phash: number;
	total: number;
	method: 'stem' | 'time' | 'phash';
};

/** 점수: stem +0.5 · 촬영시각 ±1s +0.4 · 카메라 +0.1 · pHash ≤4 +0.5 / ≤10 +0.3 */
export function scorePair(edit: PairFile, orig: PairFile): ScoreParts {
	const stem = edit.stemNorm && edit.stemNorm === orig.stemNorm ? 0.5 : 0;
	let time = 0;
	// 롤/폴더/mtime 에서 온 시각은 진짜 촬영시각이 아니므로 비교하지 않는다
	const realTime = (f: PairFile) =>
		f.takenAt && (f.takenAtSource === 'exif' || f.takenAtSource === 'xmp');
	if (
		realTime(edit) &&
		realTime(orig) &&
		Math.abs(edit.takenAt!.getTime() - orig.takenAt!.getTime()) <= 1000
	)
		time = 0.4;
	const camera =
		edit.cameraModel && orig.cameraModel && edit.cameraModel === orig.cameraModel ? 0.1 : 0;
	let phash = 0;
	if (edit.phash && orig.phash) {
		const d = hamming(edit.phash, orig.phash);
		phash = d <= 4 ? 0.5 : d <= 10 ? 0.3 : 0;
	}
	const total = Math.min(1, stem + time + camera + phash);
	const method = stem ? 'stem' : time ? 'time' : 'phash';
	return { stem, time, camera, phash, total, method };
}

export function decide(score: number): 'auto' | 'review' | 'none' {
	return score >= AUTO_THRESHOLD ? 'auto' : score >= REVIEW_THRESHOLD ? 'review' : 'none';
}

const pairSelect = {
	id: files.id,
	stemNorm: files.stemNorm,
	takenAt: files.takenAt,
	takenAtSource: files.takenAtSource,
	cameraModel: files.cameraModel,
	phash: files.phash,
	photoId: files.photoId,
	relPath: files.relPath
};

async function originalsWhere(db: Db, extra: ReturnType<typeof sql> | undefined) {
	return db
		.select(pairSelect)
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(
			and(
				eq(sources.role, 'original'),
				eq(files.status, 'active'),
				eq(files.derivativesReady, true),
				extra ?? sql`true`
			)
		);
}

/** 후보 수집: stem → 촬영시각 ±2s → pHash 전수(거리 ≤12) */
export async function findCandidates(
	db: Db,
	edit: PairFile
): Promise<{ file: PairFile; score: ScoreParts }[]> {
	let cands = await originalsWhere(db, sql`${files.stemNorm} = ${edit.stemNorm}`);
	if (
		cands.length === 0 &&
		edit.takenAt &&
		(edit.takenAtSource === 'exif' || edit.takenAtSource === 'xmp')
	) {
		const lo = new Date(edit.takenAt.getTime() - 2000);
		const hi = new Date(edit.takenAt.getTime() + 2000);
		cands = await originalsWhere(db, sql`${files.takenAt} between ${lo} and ${hi}`);
	}
	if (cands.length === 0 && edit.phash) {
		const all = await originalsWhere(db, sql`${files.phash} is not null`);
		cands = all.filter((o) => o.phash && hamming(edit.phash!, o.phash) <= 12);
	}
	return cands
		.map((file) => ({ file: file as PairFile, score: scorePair(edit, file as PairFile) }))
		.sort((a, b) => b.score.total - a.score.total);
}

export async function loadPairFile(db: Db, fileId: string): Promise<PairFile | null> {
	const [f] = await db.select(pairSelect).from(files).where(eq(files.id, fileId)).limit(1);
	return (f as PairFile | undefined) ?? null;
}

async function recalcPhoto(db: Db, photoId: string): Promise<void> {
	const vs = await db
		.select({
			id: files.id,
			kind: files.kind,
			role: files.variantRole,
			label: files.variantLabel,
			takenAt: files.takenAt,
			mtime: files.mtime,
			status: files.status,
			ready: files.derivativesReady,
			sourceTier: sources.tier,
			sourceVis: sources.defaultVisibility
		})
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(eq(files.photoId, photoId));
	const live = vs.filter((v) => v.status === 'active' && v.ready);
	if (live.length === 0) {
		if (vs.length === 0) await db.delete(photos).where(eq(photos.id, photoId));
		return;
	}
	const originals = live.filter((v) => v.role === 'original');
	const edits = live.filter((v) => v.role === 'edit');
	const original = originals.find((v) => v.kind === 'raw') ?? originals[0] ?? null;
	const primaryEdit =
		edits.find((v) => v.label === '기본') ??
		[...edits].sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0] ??
		null;
	const primary = primaryEdit ?? original ?? live[0];
	const takenAt = (original ?? primary).takenAt ?? primary.takenAt ?? null;
	const tier = edits.some((e) => e.sourceTier === 'A')
		? 'A'
		: edits.some((e) => e.sourceTier === 'B')
			? 'B'
			: null;
	await db
		.update(photos)
		.set({
			primaryFileId: primary.id,
			originalFileId: original?.id ?? null,
			takenAt,
			tier,
			updatedAt: new Date()
		})
		.where(eq(photos.id, photoId));
}

/** 보정 파일을 원본의 Photo 에 붙인다. 보정 파일이 갖고 있던 Photo 는 비면 지운다. */
export async function attachEdit(
	db: Db,
	editFileId: string,
	originalFileId: string,
	method: 'stem' | 'time' | 'phash' | 'manual',
	confidence: number,
	confirmed: boolean
): Promise<string | null> {
	const [edit] = await db
		.select({ id: files.id, photoId: files.photoId })
		.from(files)
		.where(eq(files.id, editFileId))
		.limit(1);
	const [orig] = await db
		.select({ id: files.id, photoId: files.photoId })
		.from(files)
		.where(eq(files.id, originalFileId))
		.limit(1);
	if (!edit || !orig?.photoId) return null;
	const target = orig.photoId;
	if (edit.photoId === target) {
		await db
			.update(photos)
			.set({
				pairMethod: method,
				pairConfidence: confidence,
				pairConfirmed: confirmed,
				updatedAt: new Date()
			})
			.where(eq(photos.id, target));
		return target;
	}
	const oldPhotoId = edit.photoId;
	// 보정본 Photo 가 공개였으면 합친 Photo 도 공개 (보여주려던 쪽의 의도를 따른다)
	let visibility: 'public' | 'hidden' | null = null;
	if (oldPhotoId) {
		const [old] = await db
			.select({ visibility: photos.visibility })
			.from(photos)
			.where(eq(photos.id, oldPhotoId))
			.limit(1);
		if (old?.visibility === 'public') visibility = 'public';
	}
	await db
		.update(files)
		.set({ photoId: target, updatedAt: new Date() })
		.where(eq(files.id, editFileId));
	await db
		.update(photos)
		.set({
			pairMethod: method,
			pairConfidence: confidence,
			pairConfirmed: confirmed,
			...(visibility ? { visibility } : {}),
			updatedAt: new Date()
		})
		.where(eq(photos.id, target));
	if (oldPhotoId) {
		const left = await db.select({ id: files.id }).from(files).where(eq(files.photoId, oldPhotoId));
		if (left.length === 0) await db.delete(photos).where(eq(photos.id, oldPhotoId));
		else await recalcPhoto(db, oldPhotoId);
	}
	await recalcPhoto(db, target);
	await db.delete(pairCandidates).where(eq(pairCandidates.editFileId, editFileId));
	return target;
}

/** 보정 파일을 떼어 단독 Photo 로 되돌린다. */
export async function detachEdit(db: Db, editFileId: string): Promise<void> {
	const [row] = await db
		.select({
			photoId: files.photoId,
			label: files.editLabel,
			sourceTier: sources.tier,
			sourceVis: sources.defaultVisibility,
			medium: sources.medium,
			takenAt: files.takenAt
		})
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(eq(files.id, editFileId))
		.limit(1);
	if (!row?.photoId) return;
	const old = row.photoId;
	const [p] = await db
		.insert(photos)
		.values({
			primaryFileId: editFileId,
			originalFileId: null,
			takenAt: row.takenAt,
			visibility: row.sourceVis,
			tier: row.sourceTier,
			medium: row.medium,
			pairMethod: null,
			pairConfirmed: false
		})
		.returning({ id: photos.id });
	await db
		.update(files)
		.set({ photoId: p.id, updatedAt: new Date() })
		.where(eq(files.id, editFileId));
	await recalcPhoto(db, old);
	await db
		.insert(pairCandidates)
		.values({ editFileId, originalFileId: editFileId, score: 0, method: 'manual', rejected: true })
		.onConflictDoUpdate({
			target: pairCandidates.editFileId,
			set: { rejected: true, updatedAt: new Date() }
		});
}

export type PairOutcome = {
	editFileId: string;
	decision: 'auto' | 'review' | 'none' | 'skip';
	originalFileId?: string;
	score?: number;
};

/** 보정 파일 하나를 페어링한다. 이미 원본이 붙어 있거나 거부된 후보면 건너뛴다. */
export async function pairEditFile(db: Db, editFileId: string): Promise<PairOutcome> {
	const edit = await loadPairFile(db, editFileId);
	if (!edit) return { editFileId, decision: 'skip' };
	if (edit.photoId) {
		const [p] = await db
			.select({ originalFileId: photos.originalFileId })
			.from(photos)
			.where(eq(photos.id, edit.photoId))
			.limit(1);
		if (p?.originalFileId) return { editFileId, decision: 'skip' };
	}
	const [rej] = await db
		.select({ rejected: pairCandidates.rejected })
		.from(pairCandidates)
		.where(eq(pairCandidates.editFileId, editFileId))
		.limit(1);
	if (rej?.rejected) return { editFileId, decision: 'skip' };

	const cands = await findCandidates(db, edit);
	const best = cands[0];
	if (!best) return { editFileId, decision: 'none' };
	const d = decide(best.score.total);
	if (d === 'auto') {
		await attachEdit(db, editFileId, best.file.id, best.score.method, best.score.total, false);
		return { editFileId, decision: 'auto', originalFileId: best.file.id, score: best.score.total };
	}
	if (d === 'review') {
		await db
			.insert(pairCandidates)
			.values({
				editFileId,
				originalFileId: best.file.id,
				score: best.score.total,
				method: best.score.method
			})
			.onConflictDoUpdate({
				target: pairCandidates.editFileId,
				set: {
					originalFileId: best.file.id,
					score: best.score.total,
					method: best.score.method,
					updatedAt: new Date()
				}
			});
		return {
			editFileId,
			decision: 'review',
			originalFileId: best.file.id,
			score: best.score.total
		};
	}
	return { editFileId, decision: 'none' };
}

/** 파일 하나가 처리된 뒤: 보정이면 자기 페어링, 원본이면 같은 stem 의 미페어 보정본들을 페어링. */
export async function pairAfterProcess(db: Db, fileId: string): Promise<PairOutcome[]> {
	const [row] = await db
		.select({ role: sources.role, stemNorm: files.stemNorm })
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(eq(files.id, fileId))
		.limit(1);
	if (!row) return [];
	if (row.role === 'edit') return [await pairEditFile(db, fileId)];
	const edits = await db
		.select({ id: files.id })
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.innerJoin(photos, eq(photos.id, files.photoId))
		.where(
			and(
				eq(sources.role, 'edit'),
				eq(files.stemNorm, row.stemNorm),
				eq(files.status, 'active'),
				sql`${photos.originalFileId} is null`
			)
		);
	const out: PairOutcome[] = [];
	for (const e of edits) out.push(await pairEditFile(db, e.id));
	return out;
}

/** 모든 미페어 보정본 id (관리자 '다시 페어링') */
export async function unpairedEditIds(db: Db): Promise<string[]> {
	const rows = await db
		.select({ id: files.id })
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.innerJoin(photos, eq(photos.id, files.photoId))
		.where(
			and(
				eq(sources.role, 'edit'),
				eq(files.status, 'active'),
				eq(files.derivativesReady, true),
				sql`${photos.originalFileId} is null`
			)
		);
	return rows.map((r) => r.id);
}

export { inArray, isNotNull, ne, path };
