import { fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/app.ts';
import { reparseFolderMeta } from '#lib/server/folders.ts';
import { addGear, deleteGear, listGear, updateGear, type GearKind } from '#lib/server/gear.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ gear: await listGear(db()) });

const str = (v: FormDataEntryValue | null) => {
	const s = String(v ?? '').trim();
	return s ? s : null;
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		const kindRaw = String(form.get('kind') ?? '');
		const kind: GearKind = kindRaw === 'lens' ? 'lens' : kindRaw === 'film' ? 'film' : 'camera';
		const name = str(form.get('name'));
		if (!name) return fail(400, { error: '이름을 입력하세요' });
		await addGear(db(), {
			kind,
			name,
			fixedLens: kind === 'camera' ? str(form.get('fixedLens')) : null,
			format: str(form.get('format')),
			notes: str(form.get('notes'))
		});
		const n = await reparseFolderMeta(db());
		return { ok: n ? `등록했습니다. 폴더 ${n}개의 빈 칸을 채웠습니다.` : '등록했습니다.' };
	},
	update: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const name = str(form.get('name'));
		if (!id || !name) return fail(400, { error: '이름을 입력하세요' });
		const row = await updateGear(db(), id, {
			name,
			fixedLens: form.has('fixedLens') ? str(form.get('fixedLens')) : null,
			format: str(form.get('format')),
			notes: str(form.get('notes'))
		});
		if (!row) return fail(404, { error: 'not found' });
		const n = await reparseFolderMeta(db());
		return { ok: n ? `고쳤습니다. 폴더 ${n}개의 빈 칸을 채웠습니다.` : '고쳤습니다.' };
	},
	delete: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'id' });
		await deleteGear(db(), id);
		return { ok: '지웠습니다. 이미 채워진 폴더/사진 값은 그대로 남습니다.' };
	},
	reparse: async () => {
		const n = await reparseFolderMeta(db());
		return { ok: `폴더명을 다시 읽어 ${n}개 폴더의 빈 칸을 채웠습니다.` };
	}
};
