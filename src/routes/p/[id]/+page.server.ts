import { error, fail } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import {
	getPhotoDetail,
	neighbors,
	scopeFromCtx,
	setPhotoVisibility
} from '#lib/server/gallery.ts';
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
	return { photo, nav, ctx, showGps, admin };
};

export const actions: Actions = {
	visibility: async ({ params, request, locals }) => {
		if (!locals.admin) return fail(403, { error: 'forbidden' });
		const form = await request.formData();
		const v = form.get('visibility') === 'public' ? 'public' : 'hidden';
		await setPhotoVisibility(db(), params.id, v);
		return { ok: true };
	}
};
