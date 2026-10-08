import { fmtBytes, getCacheUsage } from '#lib/server/cacheusage.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { queueCounts } from '#lib/server/queue.ts';
import { listSourcesWithCounts } from '#lib/server/sources.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [sources, queues, cache] = await Promise.all([
		listSourcesWithCounts(db()),
		queueCounts(db()),
		getCacheUsage(config.CACHE_DIR)
	]);
	return {
		sources,
		queues,
		cache: {
			total: fmtBytes(cache.bytes),
			files: cache.files,
			bySize: Object.fromEntries(Object.entries(cache.bySize).map(([k, v]) => [k, fmtBytes(v)])),
			dir: config.CACHE_DIR
		}
	};
};
