// 관리자 전용 원본 파일 서빙 — 디스크의 파일을 바이트 그대로(변환·재압축 없음) 보낸다.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { files, sources } from './db/schema';

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

/** 원본 파일 주소 — 끝에 실제 파일 이름을 넣는다. 브라우저의 '다른 이름으로 저장'이 Content-Disposition 대신
 *  주소 끝(예전엔 'original')을 이름으로 쓰는 경우가 많아, 저장한 파일 이름이 실제와 달랐다. */
export function originalUrl(fileId: string, filename: string): string {
	return `/media/${fileId}/original/${encodeURIComponent(filename)}`;
}

export async function findOriginal(db: Db, fileId: string) {
	const [row] = await db
		.select({
			relPath: files.relPath,
			ext: files.ext,
			filename: files.filename,
			rootPath: sources.rootPath
		})
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(eq(files.id, fileId))
		.limit(1);
	return row ?? null;
}

export async function serveOriginal(
	row: NonNullable<Awaited<ReturnType<typeof findOriginal>>>
): Promise<Response | null> {
	const abs = path.join(row.rootPath, row.relPath);
	const st = await stat(abs).catch(() => null);
	if (!st) return null;
	return new Response(Readable.toWeb(createReadStream(abs)) as ReadableStream, {
		headers: {
			'Content-Type': ORIGINAL_TYPES[row.ext] ?? 'application/octet-stream',
			'Content-Length': String(st.size),
			'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
			'Cache-Control': 'private, no-store'
		}
	});
}
