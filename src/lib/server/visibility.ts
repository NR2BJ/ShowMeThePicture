// 사진 공개 여부: 폴더(Source) 기본값 → 사진별 값. 관리자가 직접 바꾸면 visibility_manual 로 표시해
// 폴더 기본값을 나중에 바꿔도 덮어쓰지 않는다. (컷 A/B 는 분류일 뿐 공개 여부와 무관)
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
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
	await db
		.update(photos)
		.set({ visibility: v, visibilityManual: true, updatedAt: new Date() })
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
	updatedAt: string;
};

/** 관리자가 직접 바꾼 사진 목록 (폴더 기본값과 다른지도 같이) */
export async function listManualOverrides(db: Db): Promise<Override[]> {
	const rows = await db
		.select({
			id: photos.id,
			visibility: photos.visibility,
			tier: photos.tier,
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
		.where(eq(photos.visibilityManual, true))
		.orderBy(desc(photos.updatedAt))
		.limit(500);
	const out: Override[] = [];
	for (const r of rows) {
		out.push({
			id: r.id,
			visibility: r.visibility,
			defaultVisibility: await defaultVisibilityForPhoto(db, r.id),
			thumb: mediaUrl(r.fileId, 'thumb', versionOf(r.contentHash, r.rotation)),
			filename: r.filename,
			source: r.source,
			tier: r.tier,
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
