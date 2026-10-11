// 링크 미리보기(카카오톡·디스코드·X 등)용 JPEG. 공개 사진만, primary 파일의 preview 를 1200px JPEG 로 바꿔 캐시한다.
// (WebP 를 못 읽는 미리보기 봇이 있어 JPEG 로 준다)
import { mkdir, readFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { versionOf } from '#lib/media.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { files, photos, sources } from '#lib/server/db/schema.ts';
import { ensureDerivative } from '#lib/server/derive.ts';
import { getExifTool } from '#lib/server/exiftool.ts';
import { derivativeDir } from '#lib/server/media.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	if (!config.DATABASE_URL) error(404);
	const [row] = await db()
		.select({
			id: files.id,
			kind: files.kind,
			relPath: files.relPath,
			rotation: files.rotation,
			contentHash: files.contentHash,
			ready: files.derivativesReady,
			rootPath: sources.rootPath,
			visibility: photos.visibility
		})
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(eq(photos.id, params.id))
		.limit(1);
	if (!row || row.visibility !== 'public' || !row.ready) error(404);
	const v = versionOf(row.contentHash, row.rotation ?? 0) ?? 'x';
	const out = path.join(derivativeDir(config.CACHE_DIR, row.id), `og-${v}.jpg`);
	if (!(await stat(out).catch(() => null))) {
		const preview = await ensureDerivative(
			getExifTool(),
			config.CACHE_DIR,
			{
				id: row.id,
				kind: row.kind,
				absPath: path.join(row.rootPath, row.relPath),
				rotation: row.rotation ?? 0
			},
			'preview'
		);
		await mkdir(path.dirname(out), { recursive: true });
		const tmp = `${out}.${process.pid}.tmp`;
		await sharp(preview)
			.resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
			.jpeg({ quality: 82, mozjpeg: true })
			.toFile(tmp);
		await rename(tmp, out);
	}
	return new Response(new Uint8Array(await readFile(out)), {
		headers: {
			'Content-Type': 'image/jpeg',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
