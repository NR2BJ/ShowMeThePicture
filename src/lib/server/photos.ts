import { and, eq, inArray, sql } from 'drizzle-orm';
import { mediaUrl, versionOf } from '#lib/media.ts';
import type { Frame } from '#lib/types.ts';
import { config } from './config';
import { getDb } from './db';
import { files, photoMeta, photos } from './db/schema';
import { getSetting } from './settings';

/** 랜딩 필름 스트립 재료: 공개 보정본(설정에 따라 A컷만 / A+B) 중 무작위 n장. 방문마다 다시 섞인다. */
export async function getLandingFrames(n = 42): Promise<Frame[]> {
	const db = getDb(config.DATABASE_URL);
	const tiers = await getSetting<'A' | 'AB'>(db, 'landing_tiers', 'A');
	const rows = await db
		.select({
			id: photos.id,
			fileId: files.id,
			// 각인은 유효 카메라(수동 > 롤/EXIF) — 필름이면 롤의 카메라가 나온다
			camera: sql<string | null>`coalesce(${photoMeta.camera}, ${files.cameraModel})`,
			contentHash: files.contentHash,
			rotation: files.rotation,
			medium: photos.medium
		})
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.leftJoin(photoMeta, eq(photoMeta.photoId, photos.id))
		.where(
			and(
				eq(photos.visibility, 'public'),
				tiers === 'AB' ? inArray(photos.tier, ['A', 'B']) : eq(photos.tier, 'A'),
				eq(files.derivativesReady, true),
				eq(files.status, 'active')
			)
		)
		.orderBy(sql`random()`)
		.limit(n);

	return rows.map((r, i) => ({
		id: r.id,
		src: mediaUrl(r.fileId, 'preview', versionOf(r.contentHash, r.rotation)),
		label: (
			r.camera ?? (r.medium === 'film' ? 'FILM' : r.medium === 'digital' ? 'DIGITAL' : '')
		).toUpperCase(),
		num: String(i + 1).padStart(2, '0')
	}));
}
