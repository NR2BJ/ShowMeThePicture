import { error } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { getCollectionBySlug } from '#lib/server/collections.ts';
import { db } from '#lib/server/db/app.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!config.DATABASE_URL) error(404);
	const c = await getCollectionBySlug(db(), params.slug, !!locals.admin);
	if (!c) error(404);
	const groups = c.series.length
		? [
				...c.series
					.map((s) => ({
						key: s.id,
						title: s.title,
						items: c.items.filter((it) => it.seriesId === s.id)
					}))
					.filter((g) => g.items.length),
				...(c.items.some((it) => !it.seriesId)
					? [
							{
								key: 'rest',
								title: null as string | null,
								items: c.items.filter((it) => !it.seriesId)
							}
						]
					: [])
			]
		: [{ key: 'all', title: null as string | null, items: c.items }];
	return {
		c: {
			id: c.id,
			slug: c.slug,
			title: c.title,
			statementMd: c.statementMd,
			kind: c.kind,
			count: c.items.length
		},
		groups
	};
};
