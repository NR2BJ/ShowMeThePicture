import { error, fail } from '@sveltejs/kit';
import { filterFromCtx } from '#lib/archive.ts';
import { searchFromCtx } from '#lib/searchctx.ts';
import { searchNeighbors } from '#lib/server/searchnav.ts';
import { addPhotoToCollection, manualCollections } from '#lib/server/collections.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import {
	getPhotoDetail,
	neighbors,
	scopeFromCtx,
	setPhotoMetaOverride
} from '#lib/server/gallery.ts';
import { listGear } from '#lib/server/gear.ts';
import { setFileRotation } from '#lib/server/rotation.ts';
import { similarPhotos } from '#lib/server/search.ts';
import {
	resetPhotoTier,
	resetPhotoVisibility,
	setPhotoTierManual,
	setPhotoVisibilityManual
} from '#lib/server/visibility.ts';
import { getSetting } from '#lib/server/settings.ts';
import type { OgMeta } from '#lib/og.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	if (!config.DATABASE_URL) error(404);
	const admin = !!locals.admin;
	const photo = await getPhotoDetail(db(), params.id, admin);
	if (!photo) error(404);
	// ctx: 'archive' | 'archive:<필터 query>' | 'library:<slug>' — prev/next 가 같은 목록을 따라간다
	const ctx = url.searchParams.get('ctx') ?? 'archive';
	const scope = await scopeFromCtx(db(), ctx);
	// 검색에서 왔으면 검색 결과 순서대로, 아니면 날짜순 목록
	const fromSearch = searchFromCtx(ctx);
	const nav = fromSearch?.q
		? await searchNeighbors(db(), fromSearch, admin, photo.id)
		: await neighbors(db(), photo, {
				scope,
				// 랜딩은 공개 사진만 보여 주므로 관리자라도 공개 사진끼리 넘긴다
				admin: ctx.startsWith('landing:') ? false : admin,
				filter: filterFromCtx(ctx)
			});
	const showGps = admin || (await getSetting<boolean>(db(), 'show_gps', false));
	const gearRows = admin ? await listGear(db()) : [];
	const gear = {
		fixedLens: Object.fromEntries(
			gearRows
				.filter((g) => g.kind === 'camera' && g.fixedLens)
				.map((g) => [g.name, g.fixedLens as string])
		) as Record<string, string>,
		camera: gearRows.filter((g) => g.kind === 'camera').map((g) => g.name),
		lens: gearRows.filter((g) => g.kind === 'lens').map((g) => g.name),
		film: gearRows.filter((g) => g.kind === 'film').map((g) => g.name)
	};
	const similar = await similarPhotos(db(), { admin, photoId: photo.id, limit: 12 }).catch((e) => {
		console.error('[similar]', e);
		return [];
	});
	// 링크 미리보기: 제목(없으면 찍은 날), 장비 한 줄, 공개 사진이면 그 사진
	const when = photo.takenAt
		? new Intl.DateTimeFormat('ko-KR', {
				timeZone: 'Asia/Tokyo',
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			}).format(new Date(photo.takenAt))
		: null;
	const gearLine = [photo.effective.camera, photo.effective.lens, photo.effective.filmStock]
		.filter(Boolean)
		.join(' · ');
	const og: OgMeta = {
		title: photo.title ?? when ?? '사진',
		description: [photo.caption, gearLine, photo.title ? when : null].filter(Boolean).join(' — '),
		image: photo.visibility === 'public' ? `/og/${photo.id}.jpg` : null,
		type: 'article'
	};
	return {
		photo,
		nav,
		og,
		ctx,
		similar,
		showGps,
		admin,
		manualCollections: admin ? await manualCollections(db()) : [],
		gear
	};
};

export const actions: Actions = {
	visibility: async ({ params, request, locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const form = await request.formData();
		const v = form.get('visibility') === 'public' ? 'public' : 'hidden';
		await setPhotoVisibilityManual(db(), params.id, v);
		return { ok: true };
	},
	resetVisibility: async ({ params, locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		await resetPhotoVisibility(db(), params.id);
		return { ok: true };
	},
	/** 관리자: 컷을 직접 정한다 (A·B·없음). 숨김 사진을 A/B 로 올리면 공개로 바뀐다. */
	tier: async ({ params, request, locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const form = await request.formData();
		const t = String(form.get('tier') ?? '');
		await setPhotoTierManual(db(), params.id, t === 'A' || t === 'B' ? t : null);
		return { ok: true };
	},
	resetTier: async ({ params, locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		await resetPhotoTier(db(), params.id);
		return { ok: true };
	},
	meta: async ({ params, request, locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const form = await request.formData();
		if (form.get('clear') === 'on') {
			await setPhotoMetaOverride(db(), params.id, null);
			return { meta: true };
		}
		const s = (k: string) => {
			const v = String(form.get(k) ?? '').trim();
			return v ? v : null;
		};
		await setPhotoMetaOverride(db(), params.id, {
			camera: s('camera'),
			lens: s('lens'),
			filmStock: s('filmStock')
		});
		return { meta: true };
	},
	collect: async ({ params, request, locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const form = await request.formData();
		const collectionId = String(form.get('collectionId') ?? '');
		if (!collectionId) return fail(400, { error: 'collection' });
		await addPhotoToCollection(db(), collectionId, params.id);
		return { collected: true };
	},
	/** 관리자: 파일 하나의 방향을 저장하고 파생본을 다시 만든다 */
	rotate: async ({ request, locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const form = await request.formData();
		const fileId = String(form.get('fileId') ?? '');
		const rotation = Number(form.get('rotation'));
		if (!fileId || !Number.isInteger(rotation)) return fail(400, { error: 'bad request' });
		await setFileRotation(db(), fileId, rotation);
		return { rotated: true };
	}
};
