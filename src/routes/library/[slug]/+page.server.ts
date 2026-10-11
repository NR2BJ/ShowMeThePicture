import { error } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { filterParams, isMonthKey, parseFilter } from '#lib/archive.ts';
import {
	ARCHIVE_PAGE,
	ZONE,
	archiveFacets,
	archiveMonths,
	listArchive
} from '#lib/server/archive.ts';
import { getSourceBySlug } from '#lib/server/sources.ts';
import type { PageServerLoad } from './$types';

/** 폴더 페이지(관리자 전용): 아카이브와 같은 무한 스크롤 + 월 타임라인 + 필터. 썸네일·장수는 이 폴더의 파일 기준. */
export const load: PageServerLoad = async ({ params, url, locals }) => {
	if (!config.DATABASE_URL) error(404);
	const admin = !!locals.admin;
	const source = await getSourceBySlug(db(), params.slug);
	if (!source) error(404);
	// 폴더 페이지는 관리자 전용 작업 화면 (게스트 공개 범위는 사진 단위 공개 여부로만 정한다)
	if (!admin) error(404);
	const fromRaw = url.searchParams.get('from');
	const from = isMonthKey(fromRaw) ? fromRaw : null;
	const filter = parseFilter(url.searchParams);
	const scope = { kind: 'library' as const, sourceId: source.id };
	const [page, months, facets] = await Promise.all([
		listArchive(db(), { admin, filter, limit: ARCHIVE_PAGE, from, scope }),
		archiveMonths(db(), { admin, filter, scope }),
		archiveFacets(db(), { admin, filter, scope })
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
		query: filterParams(filter).toString(),
		items: page.items,
		hasMore: page.hasMore,
		months,
		facets,
		filter,
		total: months.reduce((n, m) => n + m.count, 0),
		from,
		zone: ZONE
	};
};
