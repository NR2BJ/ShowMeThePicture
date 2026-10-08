import { fail } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { PathEscapeError } from '#lib/server/fs.ts';
import { enqueueScan } from '#lib/server/queue.ts';
import {
	createSource,
	deleteSource,
	listSourcesWithCounts,
	type NewSource
} from '#lib/server/sources.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	sources: await listSourcesWithCounts(db()),
	photosRoot: config.PHOTOS_ROOT
});

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const relPath = String(form.get('relPath') ?? '').replace(/^\/+/, '');
		const role = form.get('role') === 'edit' ? 'edit' : 'original';
		const mediumRaw = String(form.get('medium') ?? '');
		const tierRaw = String(form.get('tier') ?? '');
		const input: NewSource = {
			name: String(form.get('name') ?? '').trim() || relPath.split('/').pop() || 'photos',
			relPath,
			role,
			medium: mediumRaw === 'film' || mediumRaw === 'digital' ? mediumRaw : null,
			tier: tierRaw === 'A' || tierRaw === 'B' ? tierRaw : null,
			defaultVisibility: form.get('defaultVisibility') === 'public' ? 'public' : 'hidden',
			libraryPublic: form.get('libraryPublic') === 'on'
		};
		if (role === 'edit' && !input.tier)
			return fail(400, { error: '보정 폴더는 A컷/B컷을 골라야 합니다', values: input });
		try {
			const src = await createSource(db(), config.PHOTOS_ROOT, input);
			await enqueueScan(src.id, true);
			return { created: src.slug };
		} catch (e) {
			if (e instanceof PathEscapeError)
				return fail(400, { error: '경로가 올바르지 않습니다', values: input });
			const msg = e instanceof Error ? e.message : String(e);
			if (/unique|duplicate/i.test(msg))
				return fail(400, { error: '이미 등록된 폴더입니다', values: input });
			throw e;
		}
	},
	scan: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'id' });
		await enqueueScan(id, form.get('full') === 'on');
		return { scanned: id };
	},
	delete: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'id' });
		await deleteSource(db(), id);
		return { deleted: id };
	}
};
