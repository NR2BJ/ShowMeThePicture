// 사이트 설정 (settings 테이블). 4단계 설정 페이지의 시작 — 지금은 랜딩 컷과 GPS 공개만.
import { fail } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { getSetting, setSetting } from '#lib/server/settings.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!config.DATABASE_URL) return { landingTiers: 'A' as const, showGps: false, noDb: true };
	return {
		landingTiers: await getSetting<'A' | 'AB'>(db(), 'landing_tiers', 'A'),
		showGps: await getSetting<boolean>(db(), 'show_gps', false),
		noDb: false
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const form = await request.formData();
		await setSetting(db(), 'landing_tiers', form.get('landingTiers') === 'AB' ? 'AB' : 'A');
		await setSetting(db(), 'show_gps', form.get('showGps') === 'on');
		return { ok: '저장했습니다.' };
	}
};
