// 잡 워커 진입점. `pnpm worker`. 1단계에서 스캔/메타/파생본 핸들러가 채워진다.
import { PgBoss } from 'pg-boss';
import { loadConfig } from '#lib/server/env.ts';
import { Q, type ScanSourceJob } from '#lib/server/jobs.ts';

const config = loadConfig(process.env);
if (!config.DATABASE_URL) {
	console.error('[worker] DATABASE_URL is required');
	process.exit(1);
}

const boss = new PgBoss({ connectionString: config.DATABASE_URL, schema: 'pgboss' });
boss.on('error', (err) => console.error('[pg-boss]', err));

await boss.start();
for (const name of Object.values(Q)) await boss.createQueue(name);

await boss.work<ScanSourceJob>(Q.SCAN_SOURCE, async (jobs) => {
	for (const job of jobs) {
		console.log('[worker] scan-source (1단계에서 구현)', job.data);
	}
});

console.log(
	`[worker] ready · photos=${config.PHOTOS_ROOT} cache=${config.CACHE_DIR} ml=${config.ML_URL}`
);

const shutdown = async () => {
	await boss.stop({ graceful: true, timeout: 10_000 });
	process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
