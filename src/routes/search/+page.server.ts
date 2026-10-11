import type { ArchiveFacets } from '#lib/archive.ts';
import { parseSearch } from '#lib/searchctx.ts';
import { archiveFacets } from '#lib/server/archive.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { MlError } from '#lib/server/ml.ts';
import { embeddingStats, searchByText, searchFloor, type SearchHit } from '#lib/server/search.ts';
import { rememberSearch } from '#lib/server/searchnav.ts';
import type { PageServerLoad } from './$types';

const EMPTY = { items: [] as SearchHit[], mean: 0, std: 0, collapsed: 0 };
const EMPTY_FACETS: ArchiveFacets = {
	medium: { film: 0, digital: 0 },
	kind: { A: 0, B: 0, original: 0 },
	camera: [],
	lens: [],
	film: []
};

/** ?q=비 오는 밤 골목 → 질의를 벡터로 바꿔 가까운 사진 60장. 보기(order: 다양하게|점수순)와 아카이브와 같은 필터.
 *  facets: 필터 선택지별 검색 대상 장수(라이브러리 기준). floor: 이 모델의 '맞는 사진 없음' 기준(없으면 null). */
export const load: PageServerLoad = async ({ url, locals }) => {
	const s = parseSearch(url.searchParams);
	const { q, order, filter } = s;
	const admin = !!locals.admin;
	const base = { q, order, filter, admin };
	if (!config.DATABASE_URL)
		return {
			...base,
			...EMPTY,
			facets: EMPTY_FACETS,
			error: null,
			stats: null,
			floor: null as number | null
		};
	const [stats, facets] = await Promise.all([
		embeddingStats(db()),
		archiveFacets(db(), { admin, filter })
	]);
	const floor = await searchFloor(db(), stats.model);
	if (!q) return { ...base, ...EMPTY, facets, error: null, stats, floor };
	try {
		const r = await searchByText(db(), { admin, text: q, limit: 60, order, filter });
		rememberSearch(s, admin, r);
		return { ...base, ...r, facets, error: null, stats, floor };
	} catch (e) {
		const msg = e instanceof MlError ? e.message : '검색 중 문제가 생겼습니다';
		console.error('[search]', e);
		return { ...base, ...EMPTY, facets, error: msg, stats, floor };
	}
};
