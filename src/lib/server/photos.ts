import { and, eq, sql } from 'drizzle-orm';
import { mediaUrl, versionOf } from '#lib/media.ts';
import type { Frame } from '#lib/types.ts';
import { config } from './config';
import { getDb } from './db';
import { files, photos } from './db/schema';

/** 랜딩 필름 스트립 재료: 공개 A컷 중 무작위 n장. 방문마다 다시 섞인다. */
export async function getLandingFrames(n = 42): Promise<Frame[]> {
	const db = getDb(config.DATABASE_URL);
	const rows = await db
		.select({
			id: photos.id,
			fileId: files.id,
			camera: files.cameraModel,
			contentHash: files.contentHash,
			medium: photos.medium
		})
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.where(
			and(
				eq(photos.visibility, 'public'),
				eq(photos.tier, 'A'),
				eq(files.derivativesReady, true),
				eq(files.status, 'active')
			)
		)
		.orderBy(sql`random()`)
		.limit(n);

	return rows.map((r, i) => ({
		id: r.id,
		src: mediaUrl(r.fileId, 'preview', versionOf(r.contentHash)),
		label: (
			r.camera ?? (r.medium === 'film' ? 'FILM' : r.medium === 'digital' ? 'DIGITAL' : '')
		).toUpperCase(),
		num: String(i + 1).padStart(2, '0')
	}));
}
