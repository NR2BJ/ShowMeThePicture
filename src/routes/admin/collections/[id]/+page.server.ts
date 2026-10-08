import { error, fail } from '@sveltejs/kit';
import {
	getCollectionById,
	movePhotoInCollection,
	rebuildSmartCollection,
	removePhotoFromCollection,
	updateCollection
} from '#lib/server/collections.ts';
import { db } from '#lib/server/db/app.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const c = await getCollectionById(db(), params.id, true);
	if (!c) error(404);
	return { c };
};

export const actions: Actions = {
	save: async ({ params, request }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { error: '제목을 입력하세요' });
		const sortRaw = String(form.get('sort') ?? '');
		await updateCollection(db(), params.id, {
			title,
			statementMd: String(form.get('statement') ?? '').trim() || null,
			visibility: form.get('visibility') === 'hidden' ? 'hidden' : 'public',
			sort: sortRaw === 'taken_desc' || sortRaw === 'manual' ? sortRaw : 'taken_asc'
		});
		return { ok: '저장했습니다' };
	},
	remove: async ({ params, request }) => {
		const form = await request.formData();
		await removePhotoFromCollection(db(), params.id, String(form.get('photoId') ?? ''));
		return { ok: '뺐습니다' };
	},
	move: async ({ params, request }) => {
		const form = await request.formData();
		await movePhotoInCollection(
			db(),
			params.id,
			String(form.get('photoId') ?? ''),
			form.get('dir') === 'up' ? 'up' : 'down'
		);
		return {};
	},
	cover: async ({ params, request }) => {
		const form = await request.formData();
		await updateCollection(db(), params.id, {
			coverPhotoId: String(form.get('photoId') ?? '') || null
		});
		return { ok: '커버를 바꿨습니다' };
	},
	rebuild: async ({ params }) => {
		const n = await rebuildSmartCollection(db(), params.id);
		return { ok: `다시 계산했습니다 (${n}장)` };
	}
};
