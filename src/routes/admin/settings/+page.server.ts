// 사이트 설정 (settings 테이블). 4단계 설정 페이지의 시작 — 지금은 랜딩 컷과 GPS 공개만.
import { fail } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { mlPing } from '#lib/server/ml.ts';
import { enqueueEmbedMany } from '#lib/server/queue.ts';
import { embeddingStats, filesNeedingEmbedding } from '#lib/server/search.ts';
import { DEFAULT_SEARCH_MODEL } from '#lib/search.ts';
import { getSetting, setSetting } from '#lib/server/settings.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!config.DATABASE_URL)
		return {
			landingTiers: 'A' as const,
			stripVh: 21,
			stripRows: 3,
			showGps: false,
			searchModel: DEFAULT_SEARCH_MODEL,
			searchLanguage: 'kor_Hang',
			embed: { model: DEFAULT_SEARCH_MODEL, done: 0, total: 0 },
			ml: { url: config.ML_URL, up: false },
			noDb: true
		};
	return {
		landingTiers: await getSetting<'A' | 'AB'>(db(), 'landing_tiers', 'A'),
		stripVh: await getSetting<number>(db(), 'landing_strip_vh', 21),
		stripRows: await getSetting<number>(db(), 'landing_rows', 3),
		showGps: await getSetting<boolean>(db(), 'show_gps', false),
		searchModel: await getSetting<string>(db(), 'search_model', DEFAULT_SEARCH_MODEL),
		searchLanguage: await getSetting<string>(db(), 'search_language', 'kor_Hang'),
		embed: await embeddingStats(db()),
		ml: { url: config.ML_URL, up: await mlPing(config.ML_URL) },
		noDb: false
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const form = await request.formData();
		await setSetting(db(), 'landing_tiers', form.get('landingTiers') === 'AB' ? 'AB' : 'A');
		const vh = Math.round(Number(form.get('stripVh')));
		await setSetting(
			db(),
			'landing_strip_vh',
			Number.isFinite(vh) ? Math.min(50, Math.max(5, vh)) : 21
		);
		const rows = Math.round(Number(form.get('stripRows')));
		await setSetting(
			db(),
			'landing_rows',
			Number.isFinite(rows) ? Math.min(10, Math.max(1, rows)) : 3
		);
		await setSetting(db(), 'show_gps', form.get('showGps') === 'on');
		const prevModel = await getSetting<string>(db(), 'search_model', DEFAULT_SEARCH_MODEL);
		const model = String(form.get('searchModel') ?? '').trim() || DEFAULT_SEARCH_MODEL;
		await setSetting(db(), 'search_model', model);
		await setSetting(
			db(),
			'search_language',
			String(form.get('searchLanguage') ?? '').trim() || 'kor_Hang'
		);
		if (model !== prevModel) {
			const n = await enqueueEmbedMany(await filesNeedingEmbedding(db(), model));
			return { ok: `저장했습니다. 모델이 바뀌어 사진 ${n}장을 다시 임베딩합니다 (워커).` };
		}
		return { ok: '저장했습니다.' };
	},
	reembed: async ({ locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const model = await getSetting<string>(db(), 'search_model', DEFAULT_SEARCH_MODEL);
		const n = await enqueueEmbedMany(await filesNeedingEmbedding(db(), model));
		return { ok: n ? `사진 ${n}장을 임베딩 큐에 넣었습니다.` : '임베딩이 빠진 사진이 없습니다.' };
	}
};
