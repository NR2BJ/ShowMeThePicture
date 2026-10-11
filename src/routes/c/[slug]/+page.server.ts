import { error } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { getCollectionBySlug } from '#lib/server/collections.ts';
import { db } from '#lib/server/db/app.ts';
import { plainSummary } from '#lib/markdown.ts';
import type { OgMeta } from '#lib/og.ts';
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
	// 링크 미리보기: 표지(지정한 사진 또는 첫 사진)가 공개면 그 사진
	const coverId = c.coverPhotoId ?? c.items[0]?.id ?? null;
	const cover = c.items.find((it) => it.id === coverId);
	const og: OgMeta = {
		title: c.title,
		description: plainSummary(c.statementMd) || `${c.items.length}장`,
		image: cover && cover.visibility === 'public' ? `/og/${cover.id}.jpg` : null
	};
	return {
		c: {
			id: c.id,
			slug: c.slug,
			title: c.title,
			statementMd: c.statementMd,
			kind: c.kind,
			count: c.items.length
		},
		groups,
		og
	};
};
