import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { MlError } from '#lib/server/ml.ts';
import { embeddingStats, searchByText } from '#lib/server/search.ts';
import type { PageServerLoad } from './$types';

/** ?q=비 오는 밤 골목 → 질의를 벡터로 바꿔 가까운 사진 60장. ML 이 없으면 안내만. */
export const load: PageServerLoad = async ({ url, locals }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const admin = !!locals.admin;
	if (!config.DATABASE_URL) return { q, items: [], error: null, stats: null, admin };
	const stats = await embeddingStats(db());
	if (!q) return { q, items: [], error: null, stats, admin };
	try {
		const items = await searchByText(db(), { admin, text: q, limit: 60 });
		return { q, items, error: null, stats, admin };
	} catch (e) {
		const msg = e instanceof MlError ? e.message : '검색 중 문제가 생겼습니다';
		console.error('[search]', e);
		return { q, items: [], error: msg, stats, admin };
	}
};
