import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/app.ts';
import { enqueueRelink, enqueueScan } from '#lib/server/queue.ts';
import {
	changeSourceRole,
	deleteSource,
	getSourceById,
	updateSource
} from '#lib/server/sources.ts';
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
		const role = String(form.get('role') ?? '') === 'edit' ? 'edit' : 'original';
		const medium = mediumRaw === 'film' || mediumRaw === 'digital' ? mediumRaw : null;
		const tier =
			tierRaw === 'A' || tierRaw === 'B' ? tierRaw : role === 'edit' ? (s.tier ?? 'A') : null;
		const defaultVisibility = form.get('visibility') === 'public' ? ('public' as const) : ('hidden' as const);
		const poll = Number(form.get('pollIntervalMin'));
		await updateSource(db(), s.id, {
			name: String(form.get('name') ?? '').trim() || s.name,
			defaultVisibility,
			pollIntervalMin: Number.isInteger(poll) && poll >= 1 ? poll : s.pollIntervalMin
		});
		// 역할·매체·컷: 역할이 바뀌면 파일 묶음/페어링을 워커가 다시 계산한다
		const changed = await changeSourceRole(db(), s.id, role, medium, tier);
		if (changed.relinkNeeded) await enqueueRelink(s.id);
		// 공개 설정은 기존 사진에도 바로 적용 (직접 바꾼 사진은 체크했을 때만)
		const applied = await applyVisibilityToSource(
			db(),
			s.id,
			defaultVisibility,
			form.get('includeManual') === 'on'
		);
		return {
			ok: `저장했습니다. 사진 ${applied}장에 공개 설정을 적용했습니다.${changed.relinkNeeded ? ` 역할이 바뀌어 ${changed.fileCount}개 파일의 묶음과 페어링을 다시 계산하는 중입니다 (워커).` : ''}`
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
