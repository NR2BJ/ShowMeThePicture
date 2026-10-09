// 아카이브 무한 스크롤용 페이지 API. 커서(경계 항목의 taken_at + id) 기준으로 과거/최근 쪽 한 페이지를 돌려준다.
import { json } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { ARCHIVE_PAGE, archiveFlags, listArchive } from '#lib/server/archive.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const headers = { 'cache-control': 'private, no-store' };
	if (!config.DATABASE_URL) return json({ items: [], hasMore: false }, { headers });
	const id = url.searchParams.get('id');
	if (!id) return json({ items: [], hasMore: false }, { headers });
	const admin = !!locals.admin;
	const { includeB } = await archiveFlags(db(), admin, url);
	const dir = url.searchParams.get('dir') === 'newer' ? 'newer' : 'older';
	const ta = url.searchParams.get('ta') || null;
	const limitRaw = Number(url.searchParams.get('limit') ?? ARCHIVE_PAGE);
	const limit = Number.isInteger(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : ARCHIVE_PAGE;
	const page = await listArchive(db(), { admin, includeB, dir, cursor: { ta, id }, limit });
	return json(page, { headers });
};
