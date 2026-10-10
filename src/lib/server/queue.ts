// app 쪽 pg-boss 클라이언트: 잡을 보내고 큐 상태를 읽기만 한다. 처리는 worker 가.
import { sql } from 'drizzle-orm';
import { PgBoss } from 'pg-boss';
import { config } from './config';
import type { Db } from './db';
import {
	Q,
	type EmbedJob,
	type PairJob,
	type ProcessFileJob,
	type RelinkJob,
	type ScanSourceJob
} from './jobs';

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

export async function enqueuePairAll(): Promise<string | null> {
	const b = await getBoss();
	const data: PairJob = { all: true };
	return b.send(Q.PAIR, data, { singletonKey: 'pair:all', singletonSeconds: 30 });
}

export async function enqueueRelink(sourceId: string): Promise<string | null> {
	const b = await getBoss();
	const data: RelinkJob = { sourceId };
	// singletonKey 를 쓰지 않는다: 역할을 연달아 바꾸면 잡이 하나씩 쌓여야 마지막 상태가 반영된다.
	// 처리 중 역할이 또 바뀐 잡은 worker 가 스스로 접는다 (relink-source 핸들러 참고).
	return b.send(Q.RELINK_SOURCE, data);
}

/** 임베딩 잡을 한꺼번에 (전체 다시 임베딩). 같은 파일이 이미 대기 중이면 중복 생성 안 함. ML 이 잠깐 죽어도 몇 번 더 시도. */
export async function enqueueEmbedMany(fileIds: string[]): Promise<number> {
	if (fileIds.length === 0) return 0;
	const b = await getBoss();
	const jobs = fileIds.map((fileId) => ({
		data: { fileId } satisfies EmbedJob,
		singletonKey: `embed:${fileId}`,
		retryLimit: 5,
		retryDelay: 60,
		retryBackoff: true
	}));
	for (let i = 0; i < jobs.length; i += 500) await b.insert(Q.EMBED, jobs.slice(i, i + 500));
	return jobs.length;
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
