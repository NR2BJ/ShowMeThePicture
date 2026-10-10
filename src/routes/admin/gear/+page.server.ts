import { fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/app.ts';
import { reparseFolderMeta } from '#lib/server/folders.ts';
import { addGear, deleteGear, listGear, type GearKind } from '#lib/server/gear.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const gear = await listGear(db());
	// 포맷 '전에 쓴 값': 프리셋 밖의 값이 또 쓰이도록
	const recentFormats = [
		...new Set(gear.map((g) => g.format).filter((x): x is string => !!x))
	].sort();
	return { gear, recentFormats };
};

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
		const aliases = String(form.get('aliases') ?? '')
			.split(/[,\n]/)
			.map((s) => s.trim())
			.filter(Boolean);
		await addGear(db(), {
			kind,
			name,
			aliases,
			fixedLens: kind === 'camera' ? str(form.get('fixedLens')) : null,
			format: str(form.get('format')),
			notes: str(form.get('notes'))
		});
		const n = await reparseFolderMeta(db());
		return { ok: n ? `등록했습니다. 폴더 ${n}개의 빈 칸을 채웠습니다.` : '등록했습니다.' };
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
