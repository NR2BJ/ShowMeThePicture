import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

const pool = new Map<string, { client: ReturnType<typeof postgres>; db: Db }>();

/** 접속 문자열별로 하나의 커넥션 풀을 공유한다. URL 이 없으면 throw (호출 측에서 빈 상태 처리). */
export function getDb(databaseUrl: string | undefined): Db {
	if (!databaseUrl) throw new Error('DATABASE_URL is not set');
	const hit = pool.get(databaseUrl);
	if (hit) return hit.db;
	const client = postgres(databaseUrl, { max: 8, onnotice: () => {} });
	const db = drizzle(client, { schema });
	pool.set(databaseUrl, { client, db });
	return db;
}

export async function closeDb(): Promise<void> {
	for (const { client } of pool.values()) await client.end({ timeout: 5 });
	pool.clear();
}

export { schema };
