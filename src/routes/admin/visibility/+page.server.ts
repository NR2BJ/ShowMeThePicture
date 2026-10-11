import { fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/app.ts';
import { setFileRotation } from '#lib/server/rotation.ts';
import {
	listManualOverrides,
	resetPhotoTier,
	resetPhotoVisibility,
	rotatedFiles
} from '#lib/server/visibility.ts';
import type { Actions, PageServerLoad } from './$types';

/** 직접 바꾼 사진: 공개 여부·컷(A/B)·방향을 관리자가 직접 정한 것. 각각 따로 되돌린다. */
export const load: PageServerLoad = async () => ({ overrides: await listManualOverrides(db()) });

export const actions: Actions = {
	reset: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('photoId') ?? '');
		if (!id) return fail(400, { error: 'id' });
		const v = await resetPhotoVisibility(db(), id);
		return { ok: `공개 여부를 폴더 기본값(${v === 'public' ? '공개' : '숨김'})으로 되돌렸습니다` };
	},
	/** 저장한 방향을 모두 0° 로 — 파생본은 다시 만든다 */
	resetRotation: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('photoId') ?? '');
		if (!id) return fail(400, { error: 'id' });
		const rs = await rotatedFiles(db(), id);
		for (const r of rs) await setFileRotation(db(), r.fileId, 0);
		return {
			ok: `방향을 원래대로 되돌렸습니다 (${rs.length}개 파일, 썸네일은 곧 다시 만들어집니다)`
		};
	},
	resetTier: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('photoId') ?? '');
		if (!id) return fail(400, { error: 'id' });
		const t = await resetPhotoTier(db(), id);
		return { ok: `컷을 자동(${t ? `${t}컷` : '컷 없음'})으로 되돌렸습니다` };
	}
};
