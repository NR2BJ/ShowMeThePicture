// 로컬 개발용: 테스트 폴더들을 Source 로 등록하고 스캔을 큐에 넣는다. 이미 있으면 건너뛴다.
//   node --env-file-if-exists=.env --import tsx scripts/dev-seed-sources.ts
import { eq } from 'drizzle-orm';
import { PgBoss } from 'pg-boss';
import { closeDb, getDb } from '#lib/server/db/index.ts';
import { sources } from '#lib/server/db/schema.ts';
import { loadConfig } from '#lib/server/env.ts';
import { safeResolve } from '#lib/server/fs.ts';
import { Q } from '#lib/server/jobs.ts';
import { createSource, type NewSource } from '#lib/server/sources.ts';

const config = loadConfig(process.env);
if (!config.DATABASE_URL) throw new Error('DATABASE_URL required');
const db = getDb(config.DATABASE_URL);
const boss = new PgBoss({ connectionString: config.DATABASE_URL, schema: 'pgboss' });
await boss.start();

const wanted: NewSource[] = [
	{
		name: 'f31fd',
		relPath: 'f31fd',
		role: 'original',
		medium: 'digital',
		tier: null,
		defaultVisibility: 'hidden',
		libraryPublic: false
	},
	{
		name: '필름',
		relPath: 'film',
		role: 'original',
		medium: 'film',
		tier: null,
		defaultVisibility: 'hidden',
		libraryPublic: true
	},
	{
		name: 'B컷',
		relPath: 'edited/B',
		role: 'edit',
		medium: null,
		tier: 'B',
		defaultVisibility: 'public',
		libraryPublic: false
	}
];
for (const w of wanted) {
	const rootPath = safeResolve(config.PHOTOS_ROOT, w.relPath);
	const [exists] = await db
		.select({ id: sources.id })
		.from(sources)
		.where(eq(sources.rootPath, rootPath))
		.limit(1);
	if (exists) {
		console.log('exists', w.relPath);
		continue;
	}
	const s = await createSource(db, config.PHOTOS_ROOT, w);
	await boss.send(Q.SCAN_SOURCE, { sourceId: s.id, full: true }, { singletonKey: `scan:${s.id}` });
	console.log('created', s.slug, '→ scan queued');
}
await boss.stop({ graceful: false });
await closeDb();
