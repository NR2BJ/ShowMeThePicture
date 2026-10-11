import { error } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { filterParams, parseFilter } from '#lib/archive.ts';
import { archiveFacets } from '#lib/server/archive.ts';
import { listPhotos } from '#lib/server/gallery.ts';
import { getSourceBySlug } from '#lib/server/sources.ts';
import type { PageServerLoad } from './$types';

const LIMIT = 150;

export const load: PageServerLoad = async ({ params, url, locals }) => {
	if (!config.DATABASE_URL) error(404);
	const admin = !!locals.admin;
	const source = await getSourceBySlug(db(), params.slug);
	if (!source) error(404);
	// 폴더 페이지는 관리자 전용 작업 화면 (게스트 공개 범위는 사진 단위 공개 여부로만 정한다)
	if (!admin) error(404);
	const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
	// 아카이브와 같은 필터 — 선택지 장수는 이 폴더 기준
	const filter = parseFilter(url.searchParams);
	const scope = { kind: 'library' as const, sourceId: source.id };
	const [{ items, hasMore, total }, facets] = await Promise.all([
		listPhotos(db(), { scope, admin, page, limit: LIMIT, filter }),
		archiveFacets(db(), { admin, scope, filter })
	]);
	return {
		source: {
			name: source.name,
			slug: source.slug,
			role: source.role,
			medium: source.medium,
			tier: source.tier,
			rootPath: source.rootPath
		},
		items,
		filter,
		query: filterParams(filter).toString(),
		facets,
		page,
		hasMore,
		total
	};
};
