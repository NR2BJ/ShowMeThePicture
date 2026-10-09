import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/app.ts';
import { fromExposure, parseExposure } from '#lib/server/exposure.ts';
import { enqueueScan } from '#lib/server/queue.ts';
import { deleteSource, getSourceById, updateSource } from '#lib/server/sources.ts';
import { applyVisibilityToSource, sourceVisibilityStats } from '#lib/server/visibility.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const s = await getSourceById(db(), params.id);
	if (!s) error(404);
	const stats = (await sourceVisibilityStats(db()))[s.id] ?? {
		publicCount: 0,
		hiddenCount: 0,
		manualCount: 0
	};
	return { s, stats };
};

export const actions: Actions = {
	save: async ({ params, request }) => {
		const form = await request.formData();
		const s = await getSourceById(db(), params.id);
		if (!s) return fail(404, { error: 'not found' });
		const mediumRaw = String(form.get('medium') ?? '');
		const tierRaw = String(form.get('tier') ?? '');
		const { defaultVisibility, libraryPublic } = fromExposure(parseExposure(form.get('exposure')));
		const poll = Number(form.get('pollIntervalMin'));
		await updateSource(db(), s.id, {
			name: String(form.get('name') ?? '').trim() || s.name,
			medium: mediumRaw === 'film' || mediumRaw === 'digital' ? mediumRaw : null,
			tier: s.role === 'edit' ? (tierRaw === 'A' || tierRaw === 'B' ? tierRaw : s.tier) : null,
			defaultVisibility,
			libraryPublic,
			pollIntervalMin: Number.isInteger(poll) && poll >= 1 ? poll : s.pollIntervalMin
		});
		// 저장하면 기존 사진에도 바로 적용한다 (직접 바꾼 사진은 체크했을 때만 덮어쓴다)
		const applied = await applyVisibilityToSource(
			db(),
			s.id,
			defaultVisibility,
			form.get('includeManual') === 'on'
		);
		return {
			ok: `저장했습니다. 사진 ${applied}장에 적용했습니다. 새로 찾는 사진도 같은 설정을 따릅니다.`
		};
	},
	bulk: async ({ params, request }) => {
		const form = await request.formData();
		const v = form.get('visibility') === 'public' ? 'public' : 'hidden';
		const n = await applyVisibilityToSource(db(), params.id, v, form.get('includeManual') === 'on');
		return { ok: `${n}장을 ${v === 'public' ? '공개' : '숨김'}으로 바꿨습니다.` };
	},
	scan: async ({ params }) => {
		await enqueueScan(params.id, true);
		return { ok: '스캔을 큐에 넣었습니다.' };
	},
	delete: async ({ params }) => {
		await deleteSource(db(), params.id);
		redirect(303, '/admin/sources');
	}
};
