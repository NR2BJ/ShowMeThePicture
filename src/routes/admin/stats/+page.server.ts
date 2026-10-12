import { db } from '#lib/server/db/app.ts';
import { topPhotos, visitDaily, visitSummary } from '#lib/server/visits.ts';
import type { PageServerLoad } from './$types';

/** 방문 통계: TODAY/TOTAL, 최근 30일, 많이 본 사진 (최근 7일 · 전체) */
export const load: PageServerLoad = async () => {
	const d = db();
	const [summary, daily, week, all] = await Promise.all([
		visitSummary(d),
		visitDaily(d, 30),
		topPhotos(d, { sinceDays: 7, limit: 12 }),
		topPhotos(d, { limit: 12 })
	]);
	return { summary, daily, week, all };
};
