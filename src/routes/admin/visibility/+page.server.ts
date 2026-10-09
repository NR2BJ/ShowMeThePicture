import { fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/app.ts';
import {
	listManualOverrides,
	resetPhotoVisibility,
	setPhotoVisibilityManual
} from '#lib/server/visibility.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ overrides: await listManualOverrides(db()) });

export const actions: Actions = {
	reset: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('photoId') ?? '');
		if (!id) return fail(400, { error: 'id' });
		const v = await resetPhotoVisibility(db(), id);
		return { ok: `폴더 기본값(${v === 'public' ? '공개' : '숨김'})으로 되돌렸습니다` };
	},
	toggle: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('photoId') ?? '');
		const v = form.get('visibility') === 'public' ? 'public' : 'hidden';
		if (!id) return fail(400, { error: 'id' });
		await setPhotoVisibilityManual(db(), id, v);
		return { ok: v === 'public' ? '공개했습니다' : '숨겼습니다' };
	}
};
