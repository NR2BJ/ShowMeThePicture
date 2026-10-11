import type { OgMeta } from '#lib/og.ts';
import { config } from '#lib/server/config.ts';
import { listCollections } from '#lib/server/collections.ts';
import { db } from '#lib/server/db/app.ts';
import type { PageServerLoad } from './$types';

const OG: OgMeta = { title: '컬렉션' };

export const load: PageServerLoad = async ({ locals }) => {
	if (!config.DATABASE_URL)
		return {
			og: OG,
			collections: []
		};
	return {
		og: OG,
		collections: await listCollections(db(), !!locals.admin)
	};
};
