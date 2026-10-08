import { error } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { listPhotos } from '#lib/server/gallery.ts';
import { getSourceBySlug } from '#lib/server/sources.ts';
import type { PageServerLoad } from './$types';

const LIMIT = 150;

export const load: PageServerLoad = async ({ params, url, locals }) => {
	if (!config.DATABASE_URL) error(404);
	const admin = !!locals.admin;
	const source = await getSourceBySlug(db(), params.slug);
	if (!source) error(404);
	if (!source.libraryPublic && !admin) error(404);
	const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
	const { items, hasMore, total } = await listPhotos(db(), {
		scope: { kind: 'library', sourceId: source.id },
		admin,
		includeB: true,
		page,
		limit: LIMIT
	});
	return {
		source: {
			name: source.name,
			slug: source.slug,
			role: source.role,
			medium: source.medium,
			tier: source.tier,
			rootPath: admin ? source.rootPath : null,
			libraryPublic: source.libraryPublic
		},
		items,
		page,
		hasMore,
		total
	};
};
