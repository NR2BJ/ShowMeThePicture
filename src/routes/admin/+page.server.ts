import { eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { fmtBytes, getCacheUsage } from '#lib/server/cacheusage.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { collections, folderMeta, gear, photos } from '#lib/server/db/schema.ts';
import { pairCounts } from '#lib/server/pairs-admin.ts';
import { queueCounts } from '#lib/server/queue.ts';
import { listSourcesWithCounts, recentFailures } from '#lib/server/sources.ts';
import type { PageServerLoad } from './$types';

const n = (c: unknown) => Number(c ?? 0);

/** 대시보드: 라이브러리 표 + 다른 탭들의 요약(사진·폴더 정보·페어링·장비·컬렉션) + 캐시·큐 */
export const load: PageServerLoad = async () => {
	const d = db();
	const [sources, queues, cache, failures, pairs, [folders], gearRows, [cols], [ph]] =
		await Promise.all([
			listSourcesWithCounts(d),
			queueCounts(d),
			getCacheUsage(config.CACHE_DIR),
			recentFailures(d),
			pairCounts(d),
			d
				.select({
					pending: sql<number>`count(*) filter (where ${isNull(folderMeta.confirmedAt)})::int`,
					confirmed: sql<number>`count(*) filter (where ${isNotNull(folderMeta.confirmedAt)})::int`
				})
				.from(folderMeta),
			d
				.select({ kind: gear.kind, n: sql<number>`count(*)::int` })
				.from(gear)
				.groupBy(gear.kind),
			d
				.select({
					total: sql<number>`count(*)::int`,
					pub: sql<number>`count(*) filter (where ${eq(collections.visibility, 'public')})::int`
				})
				.from(collections),
			d
				.select({
					total: sql<number>`count(*)::int`,
					pub: sql<number>`count(*) filter (where ${photos.visibility} = 'public')::int`,
					hidden: sql<number>`count(*) filter (where ${photos.visibility} = 'hidden')::int`,
					manual: sql<number>`count(*) filter (where ${photos.visibilityManual})::int`,
					a: sql<number>`count(*) filter (where ${photos.tier} = 'A')::int`,
					b: sql<number>`count(*) filter (where ${photos.tier} = 'B')::int`,
					original: sql<number>`count(*) filter (where ${photos.tier} is null)::int`
				})
				.from(photos)
		]);
	const gearBy = Object.fromEntries(gearRows.map((g) => [g.kind, n(g.n)]));
	return {
		sources,
		queues,
		failures,
		summary: {
			photos: {
				total: n(ph?.total),
				pub: n(ph?.pub),
				hidden: n(ph?.hidden),
				manual: n(ph?.manual),
				a: n(ph?.a),
				b: n(ph?.b),
				original: n(ph?.original)
			},
			folders: { pending: n(folders?.pending), confirmed: n(folders?.confirmed) },
			pairs,
			gear: { camera: gearBy.camera ?? 0, lens: gearBy.lens ?? 0, film: gearBy.film ?? 0 },
			collections: { total: n(cols?.total), pub: n(cols?.pub) }
		},
		cache: {
			total: fmtBytes(cache.bytes),
			files: cache.files,
			bySize: Object.fromEntries(Object.entries(cache.bySize).map(([k, v]) => [k, fmtBytes(v)])),
			dir: config.CACHE_DIR
		}
	};
};
