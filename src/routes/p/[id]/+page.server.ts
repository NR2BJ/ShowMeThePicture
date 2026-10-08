import { error, fail } from '@sveltejs/kit';
import { addPhotoToCollection, manualCollections } from '#lib/server/collections.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import {
	getPhotoDetail,
	neighbors,
	scopeFromCtx,
	setPhotoVisibility
} from '#lib/server/gallery.ts';
import { setFileRotation } from '#lib/server/rotation.ts';
import { getSetting } from '#lib/server/settings.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	if (!config.DATABASE_URL) error(404);
	const admin = !!locals.admin;
	const photo = await getPhotoDetail(db(), params.id, admin);
	if (!photo) error(404);
	const ctx = url.searchParams.get('ctx') ?? 'archive';
	const includeB = ctx.endsWith(':b') || ctx.startsWith('library:');
	const scope = await scopeFromCtx(db(), ctx.replace(/:b$/, ''));
	const nav = await neighbors(db(), photo, { scope, admin, includeB });
	const showGps = admin || (await getSetting<boolean>(db(), 'show_gps', false));
	return {
		photo,
		nav,
		ctx,
		showGps,
		admin,
		manualCollections: admin ? await manualCollections(db()) : []
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
