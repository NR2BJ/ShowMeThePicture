// 로컬 개발용: 화면 점검에 쓸 관리자 계정을 .env 의 DEV_UI_USER / DEV_UI_PASSWORD 로 만든다. 이미 있으면 건너뛴다.
//   node --env-file-if-exists=.env --import tsx scripts/dev-ui-admin.ts
import { eq } from 'drizzle-orm';
import { createAdmin } from '#lib/server/auth.ts';
import { closeDb, getDb } from '#lib/server/db/index.ts';
import { adminUsers } from '#lib/server/db/schema.ts';

const url = process.env.DATABASE_URL;
const user = process.env.DEV_UI_USER;
const pass = process.env.DEV_UI_PASSWORD;
if (!url || !user || !pass) throw new Error('DATABASE_URL, DEV_UI_USER, DEV_UI_PASSWORD required');
const db = getDb(url);
const [found] = await db
	.select({ id: adminUsers.id })
	.from(adminUsers)
	.where(eq(adminUsers.username, user));
if (found) console.log('exists:', user);
else console.log('created:', (await createAdmin(db, user, pass)).username);
await closeDb();
