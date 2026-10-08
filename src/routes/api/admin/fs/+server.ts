import { json } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { listDir, PathEscapeError } from '#lib/server/fs.ts';
import type { RequestHandler } from './$types';

/** 폴더 선택기: PHOTOS_ROOT 아래 디렉터리 목록. 경로는 상대 경로만 받고 밖으로는 못 나간다. */
export const GET: RequestHandler = async ({ url }) => {
	const rel = (url.searchParams.get('path') ?? '').replace(/^\/+/, '');
	try {
		return json(await listDir(config.PHOTOS_ROOT, rel));
	} catch (e) {
		if (e instanceof PathEscapeError) return new Response('invalid path', { status: 400 });
		const code = (e as NodeJS.ErrnoException).code;
		if (code === 'ENOENT' || code === 'ENOTDIR') return new Response('not found', { status: 404 });
		throw e;
	}
};
