// 잡 워커 진입점. `pnpm worker`.
import { ExifTool } from 'exiftool-vendored';
import { PgBoss } from 'pg-boss';
import { isNull, lt, or, sql } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index.ts';
import { sources } from '#lib/server/db/schema.ts';
import { loadConfig } from '#lib/server/env.ts';
import { Q, type PairJob, type ProcessFileJob, type ScanSourceJob } from '#lib/server/jobs.ts';
import { pairAfterProcess, pairEditFile, unpairedEditIds } from '#lib/server/pairing.ts';
import { processFile, type ProcessCtx } from './process.ts';
import { scanSource } from './scan.ts';

const config = loadConfig(process.env);
if (!config.DATABASE_URL) {
	console.error('[worker] DATABASE_URL is required');
	process.exit(1);
}
const PROCESS_CONCURRENCY = Number(process.env.PROCESS_CONCURRENCY ?? 3);
const log = (msg: string) => console.log(`[worker ${new Date().toISOString()}] ${msg}`);

const db = getDb(config.DATABASE_URL);
const exiftool = new ExifTool({ maxProcs: Math.max(1, Math.min(2, PROCESS_CONCURRENCY)) });
const ctx: ProcessCtx = { db, exiftool, cacheDir: config.CACHE_DIR, log };

const boss = new PgBoss({ connectionString: config.DATABASE_URL, schema: 'pgboss' });
boss.on('error', (err) => console.error('[pg-boss]', err));
await boss.start();
for (const name of Object.values(Q)) {
	try {
		await boss.createQueue(name);
	} catch {
		/* exists */
	}
}

await boss.work<ScanSourceJob>(Q.SCAN_SOURCE, async (jobs) => {
	for (const job of jobs) {
		const t0 = Date.now();
		const s = await scanSource(db, boss, job.data.sourceId, job.data.full ?? false);
		log(
			`scan ${job.data.sourceId}: seen=${s.seen} added=${s.added} changed=${s.changed} missing=${s.missing} requeued=${s.requeued} (${Date.now() - t0}ms)`
		);
	}
});

for (let i = 0; i < PROCESS_CONCURRENCY; i++) {
	await boss.work<ProcessFileJob>(Q.PROCESS_FILE, { batchSize: 1 }, async (jobs) => {
		for (const job of jobs) {
			const t0 = Date.now();
			await processFile(ctx, job.data.fileId);
			log(`file ${job.data.fileId} done (${Date.now() - t0}ms)`);
			await boss.send(Q.PAIR, { fileId: job.data.fileId } satisfies PairJob, {
				singletonKey: `pair:${job.data.fileId}`,
				singletonSeconds: 5
			});
		}
	});
}

await boss.work<PairJob>(Q.PAIR, async (jobs) => {
	for (const job of jobs) {
		if (job.data.all) {
			const ids = await unpairedEditIds(db);
			let auto = 0,
				review = 0;
			for (const id of ids) {
				const r = await pairEditFile(db, id);
				if (r.decision === 'auto') auto++;
				else if (r.decision === 'review') review++;
			}
			log(`pair all: ${ids.length} edits → auto=${auto} review=${review}`);
		} else if (job.data.fileId) {
			const out = await pairAfterProcess(db, job.data.fileId);
			for (const r of out)
				if (r.decision !== 'skip')
					log(
						`pair ${r.editFileId}: ${r.decision}${r.originalFileId ? ` → ${r.originalFileId} (${r.score?.toFixed(2)})` : ''}`
					);
		}
	}
});

/** 주기 스캔: 매 분 due 인 Source 를 큐에 넣는다. mergerfs 는 inotify 가 없다. */
async function schedule() {
	try {
		const due = await db
			.select({ id: sources.id })
			.from(sources)
			.where(
				or(
					isNull(sources.lastScannedAt),
					lt(sources.lastScannedAt, sql`now() - make_interval(mins => ${sources.pollIntervalMin})`)
				)
			);
		for (const s of due)
			await boss.send(Q.SCAN_SOURCE, { sourceId: s.id } satisfies ScanSourceJob, {
				singletonKey: `scan:${s.id}`,
				singletonSeconds: 60
			});
	} catch (e) {
		console.error('[worker] schedule', e);
	}
}
await schedule();
const timer = setInterval(schedule, 60_000);

log(
	`ready · photos=${config.PHOTOS_ROOT} cache=${config.CACHE_DIR} ml=${config.ML_URL} concurrency=${PROCESS_CONCURRENCY}`
);

const shutdown = async () => {
	clearInterval(timer);
	await boss.stop({ graceful: true, timeout: 15_000 });
	await exiftool.end();
	process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
