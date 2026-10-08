import { fail, redirect } from '@sveltejs/kit';
import {
	createCollection,
	deleteCollection,
	listCollections,
	listSourcesForRules,
	type SmartRule
} from '#lib/server/collections.ts';
import { db } from '#lib/server/db/app.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	collections: await listCollections(db(), true),
	sources: await listSourcesForRules(db())
});

function ruleFromForm(form: FormData): SmartRule {
	const rule: SmartRule = {};
	const medium = String(form.get('medium') ?? '');
	if (medium === 'film' || medium === 'digital') rule.medium = medium;
	const tier = String(form.get('tier') ?? '');
	if (tier === 'A' || tier === 'B') rule.tier = tier;
	const sourceId = String(form.get('sourceId') ?? '');
	if (sourceId) rule.sourceId = sourceId;
	const year = Number(form.get('year'));
	if (Number.isInteger(year) && year > 1800) rule.year = year;
	if (form.get('seriesByFolder') === 'on') rule.seriesByFolder = true;
	return rule;
}

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { error: '제목을 입력하세요' });
		const kind = form.get('kind') === 'smart' ? 'smart' : 'manual';
		const sortRaw = String(form.get('sort') ?? '');
		const sort = sortRaw === 'taken_desc' || sortRaw === 'manual' ? sortRaw : 'taken_asc';
		const row = await createCollection(db(), {
			title,
			statementMd: String(form.get('statement') ?? '').trim() || null,
			kind,
			visibility: form.get('visibility') === 'hidden' ? 'hidden' : 'public',
			sort: kind === 'manual' && sortRaw === '' ? 'manual' : sort,
			rule: kind === 'smart' ? ruleFromForm(form) : null
		});
		redirect(303, `/admin/collections/${row.id}`);
	},
	delete: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'id' });
		await deleteCollection(db(), id);
		return { ok: '삭제했습니다' };
	}
};
