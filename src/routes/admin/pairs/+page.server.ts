import { parseTab } from '#lib/pairs.ts';
import { db } from '#lib/server/db/app.ts';
import {
	acceptAllPairs,
	listPairTab,
	originalsStats,
	pairCounts,
	unconfirmAllPairs
} from '#lib/server/pairs-admin.ts';
import { enqueuePairAll } from '#lib/server/queue.ts';
import type { Actions, PageServerLoad } from './$types';

/** ?tab=review|auto|confirmed|unpaired. 첫 페이지는 여기서, 다음 페이지는 /api/admin/pairs 로. */
export const load: PageServerLoad = async ({ url }) => {
	const d = db();
	const tab = parseTab(url.searchParams.get('tab'));
	const [counts, page, originals] = await Promise.all([
		pairCounts(d),
		listPairTab(d, tab, null),
		originalsStats(d)
	]);
	return {
		tab,
		counts,
		items: page.items,
		nextCursor: page.nextCursor,
		originals,
		stamp: Date.now()
	};
};

export const actions: Actions = {
	acceptAll: async () => {
		const n = await acceptAllPairs(db());
		return { ok: `${n}장을 한 번에 확정했습니다` };
	},
	unconfirmAll: async () => {
		const n = await unconfirmAllPairs(db());
		return { ok: `${n}장의 확정을 취소했습니다 (연결은 그대로, '자동 묶임' 탭으로)` };
	},
	rerun: async () => {
		await enqueuePairAll();
		return { ok: '원본 없는 보정본 전체를 다시 페어링합니다 (워커 로그 참고)' };
	}
};
