import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { MlError } from '#lib/server/ml.ts';
import { embeddingStats, searchByText, searchFloor, type SearchHit } from '#lib/server/search.ts';
import type { PageServerLoad } from './$types';

const EMPTY = { items: [] as SearchHit[], mean: 0, std: 0, collapsed: 0 };

/** ?q=비 오는 밤 골목 → 질의를 벡터로 바꿔 가까운 사진 60장(비슷한 컷은 묶음). ML 이 없으면 안내만.
 *  floor: 관리자가 설정에서 정한 이 모델의 '맞는 사진 없음' 기준 유사도 (없으면 null). mean/std: 라이브러리 전체 분포. */
export const load: PageServerLoad = async ({ url, locals }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const admin = !!locals.admin;
	if (!config.DATABASE_URL)
		return {
			q,
			...EMPTY,
			raw: false,
			error: null,
			stats: null,
			admin,
			floor: null as number | null
		};
	const stats = await embeddingStats(db());
	const floor = await searchFloor(db(), stats.model);
	if (!q) return { q, ...EMPTY, raw: false, error: null, stats, admin, floor };
	try {
		const raw = admin && url.searchParams.get('raw') === '1';
		const r = await searchByText(db(), { admin, text: q, limit: 60, raw });
		return { q, ...r, raw, error: null, stats, admin, floor };
	} catch (e) {
		const msg = e instanceof MlError ? e.message : '검색 중 문제가 생겼습니다';
		console.error('[search]', e);
		return { q, ...EMPTY, raw: false, error: msg, stats, admin, floor };
	}
};
