// `pnpm db:migrate` — drizzle/ 의 SQL 을 순서대로 적용한다. app 컨테이너 기동 시에도 실행.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is required');
	process.exit(1);
}
const client = postgres(url, { max: 1, onnotice: () => {} });
await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
await client.end();
console.log('migrations applied');
