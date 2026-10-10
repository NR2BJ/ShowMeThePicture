import { error, fail } from '@sveltejs/kit';
import { filterFromCtx } from '#lib/archive.ts';
import { addPhotoToCollection, manualCollections } from '#lib/server/collections.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import {
	getPhotoDetail,
	neighbors,
	scopeFromCtx,
	setPhotoMetaOverride,
	setPhotoVisibility
} from '#lib/server/gallery.ts';
import { listGear } from '#lib/server/gear.ts';
import { setFileRotation } from '#lib/server/rotation.ts';
import { resetPhotoVisibility } from '#lib/server/visibility.ts';
import { getSetting } from '#lib/server/settings.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	if (!config.DATABASE_URL) error(404);
	const admin = !!locals.admin;
	const photo = await getPhotoDetail(db(), params.id, admin);
	if (!photo) error(404);
	// ctx: 'archive' | 'archive:<필터 query>' | 'library:<slug>' — prev/next 가 같은 목록을 따라간다
	const ctx = url.searchParams.get('ctx') ?? 'archive';
	const scope = await scopeFromCtx(db(), ctx);
	const nav = await neighbors(db(), photo, { scope, admin, filter: filterFromCtx(ctx) });
	const showGps = admin || (await getSetting<boolean>(db(), 'show_gps', false));
	const gearRows = admin ? await listGear(db()) : [];
	const gear = {
		camera: gearRows.filter((g) => g.kind === 'camera').map((g) => g.name),
		lens: gearRows.filter((g) => g.kind === 'lens').map((g) => g.name),
		film: gearRows.filter((g) => g.kind === 'film').map((g) => g.name)
	};
	return {
		photo,
		nav,
		ctx,
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
		await setPhotoVisibility(db(), params.id, v);
		return { ok: true };
	},
	resetVisibility: async ({ params, locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		await resetPhotoVisibility(db(), params.id);
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
