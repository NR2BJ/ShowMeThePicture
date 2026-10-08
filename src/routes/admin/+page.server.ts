import { db } from '#lib/server/db/app.ts';
import { queueCounts } from '#lib/server/queue.ts';
import { listSourcesWithCounts } from '#lib/server/sources.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [sources, queues] = await Promise.all([listSourcesWithCounts(db()), queueCounts(db())]);
	return { sources, queues };
};
