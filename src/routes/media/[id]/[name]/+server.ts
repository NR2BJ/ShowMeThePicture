// 파생 이미지(thumb/preview/full)와 관리자 전용 원본 서빙. 공개 여부를 확인하고 SSD 캐시에서 스트리밍한다.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { SIZE_NAMES, type SizeName } from '#lib/media.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { files, photos, sources } from '#lib/server/db/schema.ts';
import { ensureDerivative } from '#lib/server/derive.ts';
import { getExifTool } from '#lib/server/exiftool.ts';
import { getSetting } from '#lib/server/settings.ts';
import type { RequestHandler } from './$types';

const ORIGINAL_TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	tif: 'image/tiff',
	tiff: 'image/tiff',
	webp: 'image/webp',
	heic: 'image/heic',
	heif: 'image/heif'
};

export const GET: RequestHandler = async ({ params, locals, request }) => {
	const m = params.name.match(/^(thumb|preview|full)\.webp$/);
	const wantOriginal = params.name === 'original';
	if (!m && !wantOriginal) error(404);

	const [row] = await db()
		.select({
			id: files.id,
			contentHash: files.contentHash,
			ready: files.derivativesReady,
			relPath: files.relPath,
			kind: files.kind,
			rotation: files.rotation,
			ext: files.ext,
			filename: files.filename,
			size: files.size,
			rootPath: sources.rootPath,
			visibility: photos.visibility
		})
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.leftJoin(photos, eq(photos.id, files.photoId))
		.where(eq(files.id, params.id))
		.limit(1);
	if (!row) error(404);

	const isPublic = row.visibility === 'public';
	if (wantOriginal) {
		if (!locals.admin) error(404);
		const abs = path.join(row.rootPath, row.relPath);
		const st = await stat(abs).catch(() => null);
		if (!st) error(404);
		return new Response(Readable.toWeb(createReadStream(abs)) as ReadableStream, {
			headers: {
				'Content-Type': ORIGINAL_TYPES[row.ext] ?? 'application/octet-stream',
				'Content-Length': String(st.size),
				'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
				'Cache-Control': 'private, no-store'
			}
		});
	}

	if (!isPublic && !locals.admin) error(404);
	if (!row.ready) error(404);
	const size = m![1] as SizeName;
	if (!SIZE_NAMES.includes(size)) error(404);
	// thumb/preview 는 워커가 미리 만든다. full 은 처음 열릴 때 여기서 만들어 캐시한다.
	const edge = size === 'full' ? await getSetting<number>(db(), 'guest_max_edge', 2560) : undefined;
	const p = await ensureDerivative(
		getExifTool(),
		config.CACHE_DIR,
		{
			id: row.id,
			kind: row.kind,
			absPath: path.join(row.rootPath, row.relPath),
			rotation: row.rotation
		},
		size,
		edge
	);
	const st = await stat(p).catch(() => null);
	if (!st) error(404);

	const etag = `"${(row.contentHash ?? '').slice(0, 16)}-r${row.rotation}-${size}"`;
	if (request.headers.get('if-none-match') === etag)
		return new Response(null, { status: 304, headers: { ETag: etag } });
	return new Response(Readable.toWeb(createReadStream(p)) as ReadableStream, {
		headers: {
			'Content-Type': 'image/webp',
			'Content-Length': String(st.size),
			ETag: etag,
			'Cache-Control': isPublic ? 'public, max-age=31536000, immutable' : 'private, max-age=3600'
		}
	});
};
