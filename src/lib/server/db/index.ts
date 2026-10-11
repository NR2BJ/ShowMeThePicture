import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

// 개발 서버는 코드를 다시 불러올 때마다 이 모듈을 새로 평가한다 — 풀을 전역에 두지 않으면 연결이 쌓여
// Postgres 연결 한도를 넘는다(로컬에서 93개까지 쌓여 500). 운영에서는 한 번만 평가되므로 차이 없음.
const g = globalThis as unknown as {
	__smtpDbPool?: Map<string, { client: ReturnType<typeof postgres>; db: Db }>;
};
const pool = (g.__smtpDbPool ??= new Map());

/** 접속 문자열별로 하나의 커넥션 풀을 공유한다. URL 이 없으면 throw (호출 측에서 빈 상태 처리). */
export function getDb(databaseUrl: string | undefined): Db {
	if (!databaseUrl) throw new Error('DATABASE_URL is not set');
	const hit = pool.get(databaseUrl);
	if (hit) return hit.db;
	// idle_timeout: 쓰지 않는 연결은 1분 뒤 닫는다
	const client = postgres(databaseUrl, { max: 8, idle_timeout: 60, onnotice: () => {} });
	const db = drizzle(client, { schema });
	pool.set(databaseUrl, { client, db });
	return db;
}

export async function closeDb(): Promise<void> {
	for (const { client } of pool.values()) await client.end({ timeout: 5 });
	pool.clear();
}

export { schema };
