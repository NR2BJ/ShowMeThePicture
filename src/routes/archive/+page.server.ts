import { isMonthKey, parseFilter, type ArchiveFacets } from '#lib/archive.ts';
import {
	ARCHIVE_PAGE,
	ZONE,
	archiveFacets,
	archiveMonths,
	listArchive
} from '#lib/server/archive.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import type { PageServerLoad } from './$types';

const EMPTY_FACETS: ArchiveFacets = {
	medium: { film: 0, digital: 0 },
	kind: { A: 0, B: 0, original: 0 },
	camera: [],
	lens: [],
	film: []
};

/** 첫 페이지(또는 ?from=YYYY-MM 그 달부터), 월 히스토그램, 필터 facet. 이후 페이지는 /api/archive 로 이어 붙인다. */
export const load: PageServerLoad = async ({ url, locals }) => {
	const admin = !!locals.admin;
	const fromRaw = url.searchParams.get('from');
	const from = isMonthKey(fromRaw) ? fromRaw : null;
	const filter = parseFilter(url.searchParams);
	if (!config.DATABASE_URL)
		return {
			items: [],
			hasMore: false,
			months: [],
			facets: EMPTY_FACETS,
			filter,
			total: 0,
			from,
			zone: ZONE,
			noDb: true
		};
	const [page, months, facets] = await Promise.all([
		listArchive(db(), { admin, filter, limit: ARCHIVE_PAGE, from }),
		archiveMonths(db(), { admin, filter }),
		archiveFacets(db(), { admin, filter })
	]);
	return {
		items: page.items,
		hasMore: page.hasMore,
		months,
		facets,
		filter,
		total: months.reduce((n, m) => n + m.count, 0),
		from,
		zone: ZONE,
		noDb: false
	};
};
