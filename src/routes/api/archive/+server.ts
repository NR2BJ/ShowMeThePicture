// 아카이브·폴더 페이지 무한 스크롤용 페이지 API. 커서(경계 항목의 taken_at + id) 기준으로 과거/최근 쪽 한 페이지를 돌려준다. 필터는 /archive 와 같은 파라미터.
import { json } from '@sveltejs/kit';
import { parseFilter } from '#lib/archive.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { ARCHIVE_PAGE, archiveItemsByIds, listArchive } from '#lib/server/archive.ts';
import { getSourceBySlug } from '#lib/server/sources.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const headers = { 'cache-control': 'private, no-store' };
	if (!config.DATABASE_URL) return json({ items: [], hasMore: false }, { headers });
	const admin = !!locals.admin;
	const filter = parseFilter(url.searchParams);
	const slug = url.searchParams.get('source');
	let scope: { kind: 'library'; sourceId: string } | undefined;
	if (slug) {
		const src = admin ? await getSourceBySlug(db(), slug) : null;
		if (!src) return json({ items: [], hasMore: false }, { headers, status: 404 });
		scope = { kind: 'library', sourceId: src.id };
	}
	// ids=a,b,c: 되살린 목록에서 바뀐 사진만 새로 받기
	const ids = url.searchParams.get('ids');
	if (ids) {
		const items = await archiveItemsByIds(db(), {
			admin,
			filter,
			scope,
			ids: ids.split(',').filter(Boolean)
		});
		return json({ items, hasMore: false }, { headers });
	}
	const id = url.searchParams.get('id');
	if (!id) return json({ items: [], hasMore: false }, { headers });
	const dir = url.searchParams.get('dir') === 'newer' ? 'newer' : 'older';
	const ta = url.searchParams.get('ta') || null;
	const limitRaw = Number(url.searchParams.get('limit') ?? ARCHIVE_PAGE);
	const limit = Number.isInteger(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : ARCHIVE_PAGE;
	const page = await listArchive(db(), { admin, filter, dir, cursor: { ta, id }, limit, scope });
	return json(page, { headers });
};
