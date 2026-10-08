// app 쪽 pg-boss 클라이언트: 잡을 보내고 큐 상태를 읽기만 한다. 처리는 worker 가.
import { sql } from 'drizzle-orm';
import { PgBoss } from 'pg-boss';
import { config } from './config';
import type { Db } from './db';
import { Q, type ProcessFileJob, type ScanSourceJob } from './jobs';

let boss: PgBoss | null = null;
let starting: Promise<PgBoss> | null = null;

export async function getBoss(): Promise<PgBoss> {
	if (boss) return boss;
	if (!starting) {
		starting = (async () => {
			if (!config.DATABASE_URL) throw new Error('DATABASE_URL is not set');
			const b = new PgBoss({ connectionString: config.DATABASE_URL, schema: 'pgboss' });
			b.on('error', (err) => console.error('[pg-boss/app]', err));
			await b.start();
			for (const name of Object.values(Q)) {
				try {
					await b.createQueue(name);
				} catch {
					/* 이미 있음 */
				}
			}
			boss = b;
			return b;
		})();
	}
	return starting;
}

export async function enqueueScan(sourceId: string, full = false): Promise<string | null> {
	const b = await getBoss();
	const data: ScanSourceJob = { sourceId, full };
	return b.send(Q.SCAN_SOURCE, data, { singletonKey: `scan:${sourceId}`, singletonSeconds: 30 });
}

export async function enqueueProcess(fileId: string): Promise<string | null> {
	const b = await getBoss();
	const data: ProcessFileJob = { fileId };
	return b.send(Q.PROCESS_FILE, data, { singletonKey: `file:${fileId}`, singletonSeconds: 10 });
}

export type QueueCount = { name: string; state: string; count: number };

/** 큐별 상태 집계 (관리자 대시보드). pgboss 스키마가 아직 없으면 빈 배열. */
export async function queueCounts(db: Db): Promise<QueueCount[]> {
	try {
		const rows = await db.execute(
			sql`select name, state, count(*)::int as count from pgboss.job group by 1, 2 order by 1, 2`
		);
		return (rows as unknown as QueueCount[]).map((r) => ({
			name: r.name,
			state: r.state,
			count: Number(r.count)
		}));
	} catch {
		return [];
	}
}
