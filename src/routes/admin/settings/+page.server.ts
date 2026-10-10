// 사이트 설정 (settings 테이블). 4단계 설정 페이지의 시작 — 지금은 랜딩 컷과 GPS 공개만.
import { fail } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { embedImage, embedText, mlPing, MlError, normalizeNllbLang } from '#lib/server/ml.ts';
import { deleteModelCache, listModelCaches } from '#lib/server/mlcache.ts';
import { fmtBytes } from '#lib/server/cacheusage.ts';
import { derivativePath } from '#lib/server/media.ts';
import { readFile } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { files, photos } from '#lib/server/db/schema.ts';
import { enqueueEmbedMany } from '#lib/server/queue.ts';
import {
	clearEmbeddings,
	embeddingStats,
	diversityStrength,
	dupThreshold,
	filesNeedingEmbedding,
	searchFloor
} from '#lib/server/search.ts';
import { DEFAULT_DIVERSITY, DEFAULT_DUP_THRESHOLD, DEFAULT_SEARCH_MODEL } from '#lib/search.ts';
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
			searchFloor: null as number | null,
			searchDup: DEFAULT_DUP_THRESHOLD,
			searchDiversity: DEFAULT_DIVERSITY,
			searchHub: false,
			embed: { model: DEFAULT_SEARCH_MODEL, done: 0, total: 0, other: 0 },
			ml: { url: config.ML_URL, up: false },
			modelCaches: null,
			noDb: true
		};
	const searchModel = await getSetting<string>(db(), 'search_model', DEFAULT_SEARCH_MODEL);
	return {
		landingTiers: await getSetting<'A' | 'AB'>(db(), 'landing_tiers', 'A'),
		stripVh: await getSetting<number>(db(), 'landing_strip_vh', 21),
		stripRows: await getSetting<number>(db(), 'landing_rows', 3),
		showGps: await getSetting<boolean>(db(), 'show_gps', false),
		searchModel,
		searchLanguage: normalizeNllbLang(await getSetting<string>(db(), 'search_language', 'ko')),
		searchFloor: await searchFloor(db(), searchModel),
		searchDup: await dupThreshold(db()),
		searchDiversity: await diversityStrength(db()),
		searchHub: await getSetting<boolean>(db(), 'search_hub', false),
		embed: await embeddingStats(db()),
		ml: { url: config.ML_URL, up: await mlPing(config.ML_URL) },
		// 받아 둔 모델 캐시 (ml-cache 볼륨이 app 에 마운트돼 있을 때만)
		modelCaches:
			(await listModelCaches(config.ML_CACHE_DIR))?.map((m) => ({
				...m,
				size: fmtBytes(m.bytes)
			})) ?? null,
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
		await setSetting(db(), 'search_hub', form.get('searchHub') === 'on');
		const prevModel = await getSetting<string>(db(), 'search_model', DEFAULT_SEARCH_MODEL);
		const model = String(form.get('searchModel') ?? '').trim() || DEFAULT_SEARCH_MODEL;
		await setSetting(db(), 'search_model', model);
		await setSetting(
			db(),
			'search_language',
			normalizeNllbLang(String(form.get('searchLanguage') ?? ''))
		);
		// 기준 유사도는 입력이 가리키는 모델(floorModel)에만 적용 — 모델을 바꾸는 제출에 이전 모델 값이 딸려 와도 섞이지 않게
		if (String(form.get('floorModel') ?? '') === model) {
			const floors = { ...(await getSetting<Record<string, number>>(db(), 'search_floor', {})) };
			const raw = String(form.get('searchFloor') ?? '').trim();
			const v = Number(raw);
			if (raw === '' || !Number.isFinite(v) || v <= 0) delete floors[model];
			else floors[model] = Math.min(1, v);
			await setSetting(db(), 'search_floor', floors);
		}
		const dupRaw = String(form.get('searchDup') ?? '').trim();
		const dup = Number(dupRaw);
		await setSetting(
			db(),
			'search_dup',
			dupRaw !== '' && Number.isFinite(dup) ? Math.min(1, Math.max(0, dup)) : DEFAULT_DUP_THRESHOLD
		);
		const divRaw = String(form.get('searchDiversity') ?? '').trim();
		const div = Number(divRaw);
		await setSetting(
			db(),
			'search_diversity',
			divRaw !== '' && Number.isFinite(div) ? Math.min(2, Math.max(0, div)) : DEFAULT_DIVERSITY
		);
		if (model !== prevModel)
			return {
				ok: `저장했습니다. 모델이 바뀌었습니다 — '모델 시험'으로 올라오는지 확인한 뒤 '빠진 임베딩 채우기'를 누르세요. 그 전에도 새로 처리되는 사진은 새 모델로 임베딩됩니다.`
			};
		return { ok: '저장했습니다.' };
	},
	deleteModelCache: async ({ request, locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const form = await request.formData();
		const name = String(form.get('name') ?? '');
		const current = await getSetting<string>(db(), 'search_model', DEFAULT_SEARCH_MODEL);
		if (name === current) return fail(400, { error: '지금 쓰는 모델의 캐시는 지우지 않습니다.' });
		const r = await deleteModelCache(config.ML_CACHE_DIR, name);
		if (r === 'ok') return { ok: `${name} 캐시를 지웠습니다.` };
		if (r === 'denied')
			return fail(409, {
				error: `${name} 은 ml 컨테이너가 root 로 받은 파일이라 지금은 못 지웁니다. Portainer 에서 app 컨테이너를 한 번 재시작하면(기동 때 소유권을 맞춤) 지울 수 있습니다.`
			});
		return fail(404, { error: '그 모델 캐시가 없습니다.' });
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
