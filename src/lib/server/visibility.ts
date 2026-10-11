// 사진 공개 여부: 폴더(Source) 기본값 → 사진별 값. 관리자가 직접 바꾸면 visibility_manual 로 표시해
// 폴더 기본값을 나중에 바꿔도 덮어쓰지 않는다. 컷(A/B)도 사진별로 직접 정할 수 있다(tier_manual) — 숨김 사진을 A/B 로 올리면 공개로.
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { mediaUrl, versionOf } from '#lib/media.ts';
import type { Db } from './db';
import { files, photos, sources } from './db/schema';

export type Visibility = 'public' | 'hidden';

/** 사진의 "폴더 기본값": 보정본이 있으면 보정 폴더의 기본값, 없으면 원본 폴더의 기본값 */
export async function defaultVisibilityForPhoto(db: Db, photoId: string): Promise<Visibility> {
	const rows = await db
		.select({ role: sources.role, def: sources.defaultVisibility })
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(and(eq(files.photoId, photoId), eq(files.status, 'active')));
	const edit = rows.find((r) => r.role === 'edit');
	if (edit) return edit.def;
	return rows[0]?.def ?? 'hidden';
}

export async function setPhotoVisibilityManual(
	db: Db,
	photoId: string,
	v: Visibility
): Promise<void> {
	// 폴더 기본값과 같아지면 '직접 바꿈'이 아니다 — 표시를 지워 모아보기에서 빠지고 폴더 일괄 적용을 다시 따른다
	const def = await defaultVisibilityForPhoto(db, photoId);
	await db
		.update(photos)
		.set({ visibility: v, visibilityManual: v !== def, updatedAt: new Date() })
		.where(eq(photos.id, photoId));
}

export async function resetPhotoVisibility(db: Db, photoId: string): Promise<Visibility> {
	const v = await defaultVisibilityForPhoto(db, photoId);
	await db
		.update(photos)
		.set({ visibility: v, visibilityManual: false, updatedAt: new Date() })
		.where(eq(photos.id, photoId));
	return v;
}

export type Tier = 'A' | 'B';

/** 사진의 "자동 컷": 보정 폴더 컷 중 A 가 있으면 A, B 가 있으면 B, 보정본이 없으면 null */
export async function defaultTierForPhoto(db: Db, photoId: string): Promise<Tier | null> {
	const rows = await db
		.select({ tier: sources.tier })
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(
			and(eq(files.photoId, photoId), eq(files.status, 'active'), eq(files.variantRole, 'edit'))
		);
	return rows.some((r) => r.tier === 'A') ? 'A' : rows.some((r) => r.tier === 'B') ? 'B' : null;
}

/** 컷을 직접 정한다. 숨김 사진을 A/B 로 올리면 공개로 바꾼다(그 뒤 숨기기로 다시 숨길 수 있다). */
export async function setPhotoTierManual(
	db: Db,
	photoId: string,
	tier: Tier | null
): Promise<{ madePublic: boolean }> {
	const [p] = await db
		.select({ visibility: photos.visibility })
		.from(photos)
		.where(eq(photos.id, photoId))
		.limit(1);
	if (!p) return { madePublic: false };
	const madePublic = tier !== null && p.visibility === 'hidden';
	// 자동 컷·폴더 기본값과 같아지면 '직접 바꿈' 표시를 남기지 않는다
	const autoTier = await defaultTierForPhoto(db, photoId);
	const defVis = madePublic ? await defaultVisibilityForPhoto(db, photoId) : null;
	await db
		.update(photos)
		.set({
			tier,
			tierManual: tier !== autoTier,
			...(madePublic
				? { visibility: 'public' as const, visibilityManual: defVis !== 'public' }
				: {}),
			updatedAt: new Date()
		})
		.where(eq(photos.id, photoId));
	return { madePublic };
}

/** 직접 정한 컷을 풀고 자동 컷으로. 공개 여부는 그대로 둔다(따로 되돌린다). */
export async function resetPhotoTier(db: Db, photoId: string): Promise<Tier | null> {
	const t = await defaultTierForPhoto(db, photoId);
	await db
		.update(photos)
		.set({ tier: t, tierManual: false, updatedAt: new Date() })
		.where(eq(photos.id, photoId));
	return t;
}

/** 폴더에 속한 사진들에 공개 여부를 일괄 적용. includeManual=false 면 수동 설정은 건드리지 않는다. */
export async function applyVisibilityToSource(
	db: Db,
	sourceId: string,
	v: Visibility,
	includeManual: boolean
): Promise<number> {
	const ids = (
		await db
			.select({ id: photos.id })
			.from(photos)
			.where(
				and(
					sql`exists (select 1 from ${files} f where f.photo_id = ${photos.id} and f.source_id = ${sourceId})`,
					includeManual ? sql`true` : eq(photos.visibilityManual, false)
				)
			)
	).map((r) => r.id);
	for (let i = 0; i < ids.length; i += 500) {
		await db
			.update(photos)
			.set({
				visibility: v,
				...(includeManual ? { visibilityManual: false } : {}),
				updatedAt: new Date()
			})
			.where(inArray(photos.id, ids.slice(i, i + 500)));
	}
	return ids.length;
}

export type Override = {
	id: string;
	visibility: Visibility;
	defaultVisibility: Visibility;
	thumb: string;
	filename: string;
	source: string;
	tier: 'A' | 'B' | null;
	visibilityManual: boolean;
	tierManual: boolean;
	defaultTier: 'A' | 'B' | null;
	/** 직접 돌려 저장한 파일들 (turns: 1=90° 오른쪽, 2=180°, 3=90° 왼쪽) */
	rotations: RotatedFile[];
	updatedAt: string;
};

export type RotatedFile = { fileId: string; name: string; turns: 1 | 2 | 3 };

/** 사진에서 방향을 저장해 둔 파일들 — 보정본/RAW/JPG 이름과 같이 */
export async function rotatedFiles(db: Db, photoId: string): Promise<RotatedFile[]> {
	const rows = await db
		.select({
			id: files.id,
			rotation: files.rotation,
			kind: files.kind,
			role: files.variantRole,
			label: files.variantLabel
		})
		.from(files)
		.where(and(eq(files.photoId, photoId), eq(files.status, 'active')));
	return rows
		.filter((r) => ((r.rotation % 4) + 4) % 4 !== 0)
		.map((r) => ({
			fileId: r.id,
			name:
				r.role === 'edit'
					? `보정본${r.label && r.label !== '기본' ? ` ${r.label}` : ''}`
					: r.kind === 'raw'
						? 'RAW'
						: 'JPG',
			turns: (((r.rotation % 4) + 4) % 4) as 1 | 2 | 3
		}));
}

/** 관리자가 직접 바꾼 사진 목록 — 공개 여부·컷이 기본값과 다르거나, 방향을 저장한 파일이 있는 것 */
export async function listManualOverrides(db: Db): Promise<Override[]> {
	const rows = await db
		.select({
			id: photos.id,
			visibility: photos.visibility,
			tier: photos.tier,
			visibilityManual: photos.visibilityManual,
			tierManual: photos.tierManual,
			updatedAt: photos.updatedAt,
			fileId: files.id,
			filename: files.filename,
			contentHash: files.contentHash,
			rotation: files.rotation,
			source: sources.name
		})
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(
			or(
				eq(photos.visibilityManual, true),
				eq(photos.tierManual, true),
				// 방향을 저장한 파일이 있는 사진
				sql`exists (select 1 from ${files} f where f.photo_id = ${photos.id} and f.status = 'active' and f.rotation % 4 <> 0)`
			)
		)
		.orderBy(desc(photos.updatedAt))
		.limit(500);
	const out: Override[] = [];
	for (const r of rows) {
		const defaultVisibility = await defaultVisibilityForPhoto(db, r.id);
		const defaultTier = await defaultTierForPhoto(db, r.id);
		const visDiff = r.visibilityManual && r.visibility !== defaultVisibility;
		const tierDiff = r.tierManual && r.tier !== defaultTier;
		// 기본값과 같아진 '직접 바꿈' 표시는 여기서 정리한다 (예전에 남은 것 포함)
		if ((r.visibilityManual && !visDiff) || (r.tierManual && !tierDiff))
			await db
				.update(photos)
				.set({ visibilityManual: visDiff, tierManual: tierDiff })
				.where(eq(photos.id, r.id));
		const rotations = await rotatedFiles(db, r.id);
		if (!visDiff && !tierDiff && rotations.length === 0) continue;
		out.push({
			id: r.id,
			visibility: r.visibility,
			defaultVisibility,
			thumb: mediaUrl(r.fileId, 'thumb', versionOf(r.contentHash, r.rotation)),
			filename: r.filename,
			source: r.source,
			tier: r.tier,
			visibilityManual: visDiff,
			tierManual: tierDiff,
			defaultTier,
			rotations,
			updatedAt: r.updatedAt.toISOString()
		});
	}
	return out;
}

/** 폴더별 사진 공개 현황 */
export async function sourceVisibilityStats(
	db: Db
): Promise<Record<string, { publicCount: number; hiddenCount: number; manualCount: number }>> {
	const rows = (await db.execute(sql`
		select f.source_id,
		       count(distinct p.id) filter (where p.visibility = 'public')::int as public_count,
		       count(distinct p.id) filter (where p.visibility = 'hidden')::int as hidden_count,
		       count(distinct p.id) filter (where p.visibility_manual)::int as manual_count
		from ${files} f join ${photos} p on p.id = f.photo_id
		group by f.source_id`)) as unknown as {
		source_id: string;
		public_count: number;
		hidden_count: number;
		manual_count: number;
	}[];
	return Object.fromEntries(
		rows.map((r) => [
			r.source_id,
			{
				publicCount: Number(r.public_count),
				hiddenCount: Number(r.hidden_count),
				manualCount: Number(r.manual_count)
			}
		])
	);
}
