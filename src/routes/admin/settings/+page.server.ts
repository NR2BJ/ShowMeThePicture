// 사이트 설정 (settings 테이블). 4단계 설정 페이지의 시작 — 지금은 랜딩 컷과 GPS 공개만.
import { fail } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { embedImage, embedText, mlPing, MlError, normalizeNllbLang } from '#lib/server/ml.ts';
import { derivativePath } from '#lib/server/media.ts';
import { readFile } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { files, photos } from '#lib/server/db/schema.ts';
import { enqueueEmbedMany } from '#lib/server/queue.ts';
import { clearEmbeddings, embeddingStats, filesNeedingEmbedding } from '#lib/server/search.ts';
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
			searchLanguage: 'ko',
			embed: { model: DEFAULT_SEARCH_MODEL, done: 0, total: 0, other: 0 },
			ml: { url: config.ML_URL, up: false },
			noDb: true
		};
	return {
		landingTiers: await getSetting<'A' | 'AB'>(db(), 'landing_tiers', 'A'),
		stripVh: await getSetting<number>(db(), 'landing_strip_vh', 21),
		stripRows: await getSetting<number>(db(), 'landing_rows', 3),
		showGps: await getSetting<boolean>(db(), 'show_gps', false),
		searchModel: await getSetting<string>(db(), 'search_model', DEFAULT_SEARCH_MODEL),
		searchLanguage: normalizeNllbLang(await getSetting<string>(db(), 'search_language', 'ko')),
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
			normalizeNllbLang(String(form.get('searchLanguage') ?? ''))
		);
		if (model !== prevModel)
			return {
				ok: `저장했습니다. 모델이 바뀌었습니다 — '모델 시험'으로 올라오는지 확인한 뒤 '빠진 임베딩 채우기'를 누르세요. 그 전에도 새로 처리되는 사진은 새 모델로 임베딩됩니다.`
			};
		return { ok: '저장했습니다.' };
	},
	clearEmbeddings: async ({ locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const n = await clearEmbeddings(db());
		return { ok: `임베딩 ${n}개를 지웠습니다. '빠진 임베딩 채우기'로 다시 만듭니다.` };
	},
	/** 저장된 모델로 글 한 줄 + 사진 한 장만 인코딩해 본다. 첫 호출은 모델 내려받기·GPU 로딩이라 오래 걸릴 수 있다. */
	testModel: async ({ locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const d = db();
		const cfg = {
			url: config.ML_URL,
			model: await getSetting<string>(d, 'search_model', DEFAULT_SEARCH_MODEL),
			language: normalizeNllbLang(await getSetting<string>(d, 'search_language', 'ko'))
		};
		try {
			const t0 = Date.now();
			const tv = await embedText(cfg, '비 오는 밤 골목', 600_000);
			const t1 = Date.now();
			// preview 파생본이 이미 있는 사진 하나
			const cands = await d
				.select({ id: files.id })
				.from(photos)
				.innerJoin(files, eq(files.id, photos.primaryFileId))
				.where(and(eq(files.status, 'active'), eq(files.derivativesReady, true)))
				.limit(20);
			let imgMsg = '사진 없음';
			for (const c of cands) {
				const bytes = await readFile(derivativePath(config.CACHE_DIR, c.id, 'preview')).catch(
					() => null
				);
				if (!bytes) continue;
				const t2 = Date.now();
				const iv = await embedImage(cfg, new Uint8Array(bytes), 600_000);
				imgMsg = `사진 ${((Date.now() - t2) / 1000).toFixed(1)}s (${iv.length}차원)`;
				break;
			}
			return {
				ok: `${cfg.model} 동작: 글 ${((t1 - t0) / 1000).toFixed(1)}s (${tv.length}차원) · ${imgMsg}. 두 번째부터는 훨씬 빠릅니다.`
			};
		} catch (e) {
			return fail(502, {
				error: `${cfg.model} 실패: ${e instanceof MlError ? e.message : String(e)} — ml 컨테이너 로그(docker logs)와 GPU 메모리를 확인하세요.`
			});
		}
	},
	reembed: async ({ locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const model = await getSetting<string>(db(), 'search_model', DEFAULT_SEARCH_MODEL);
		const n = await enqueueEmbedMany(await filesNeedingEmbedding(db(), model));
		return { ok: n ? `사진 ${n}장을 임베딩 큐에 넣었습니다.` : '임베딩이 빠진 사진이 없습니다.' };
	}
};
