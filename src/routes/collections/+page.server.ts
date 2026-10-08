import { config } from '#lib/server/config.ts';
import { listCollections } from '#lib/server/collections.ts';
import { db } from '#lib/server/db/app.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!config.DATABASE_URL) return { collections: [] };
	return { collections: await listCollections(db(), !!locals.admin) };
};
