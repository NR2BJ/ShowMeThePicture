// 단일 관리자 인증. 비밀번호는 Node 내장 scrypt, 세션은 HMAC 서명 쿠키(상태 없음).
// 세션 서명 키는 첫 기동 때 생성해 settings 에 둔다 — 환경변수가 없어도 된다.
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { adminUsers } from './db/schema';
import { getSetting, setSetting } from './settings';

const scrypt = promisify(scryptCb) as (
	pw: string,
	salt: Buffer,
	len: number,
	opts: object
) => Promise<Buffer>;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const SESSION_COOKIE = 'smtp_admin';
const SESSION_TTL_S = 30 * 24 * 3600;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await scrypt(password, salt, 64, SCRYPT);
	return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [algo, saltB64, keyB64] = stored.split('$');
	if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
	const expected = Buffer.from(keyB64, 'base64url');
	const actual = await scrypt(password, Buffer.from(saltB64, 'base64url'), expected.length, SCRYPT);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let secretCache: Buffer | null = null;
/** env 로 명시했으면 그것을, 아니면 settings.session_secret (없으면 생성). */
export async function getSessionSecret(db: Db, envSecret: string | undefined): Promise<Buffer> {
	if (secretCache) return secretCache;
	if (envSecret && envSecret !== 'dev-secret-change-me') {
		secretCache = Buffer.from(envSecret, 'utf8');
		return secretCache;
	}
	let hex = await getSetting<string | null>(db, 'session_secret', null);
	if (!hex) {
		hex = randomBytes(32).toString('hex');
		await setSetting(db, 'session_secret', hex);
	}
	secretCache = Buffer.from(hex, 'hex');
	return secretCache;
}

type SessionPayload = { sub: string; exp: number };

function sign(payload: string, secret: Buffer): string {
	return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSessionToken(adminId: string, secret: Buffer): string {
	const payload = Buffer.from(
		JSON.stringify({
			sub: adminId,
			exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S
		} satisfies SessionPayload)
	).toString('base64url');
	return `${payload}.${sign(payload, secret)}`;
}

export function readSessionToken(token: string | undefined, secret: Buffer): SessionPayload | null {
	if (!token) return null;
	const [payload, sig] = token.split('.');
	if (!payload || !sig) return null;
	const expected = sign(payload, secret);
	const a = Buffer.from(sig);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
	try {
		const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionPayload;
		if (typeof data.sub !== 'string' || typeof data.exp !== 'number') return null;
		if (data.exp < Date.now() / 1000) return null;
		return data;
	} catch {
		return null;
	}
}

export function setSessionCookie(cookies: Cookies, token: string, secure: boolean): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge: SESSION_TTL_S
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export type AdminUser = { id: string; username: string };

export async function adminCount(db: Db): Promise<number> {
	const rows = await db.select({ id: adminUsers.id }).from(adminUsers);
	return rows.length;
}

export async function findAdminById(db: Db, id: string): Promise<AdminUser | null> {
	const rows = await db
		.select({ id: adminUsers.id, username: adminUsers.username })
		.from(adminUsers)
		.where(eq(adminUsers.id, id))
		.limit(1);
	return rows[0] ?? null;
}

export async function authenticate(
	db: Db,
	username: string,
	password: string
): Promise<AdminUser | null> {
	const rows = await db
		.select({
			id: adminUsers.id,
			username: adminUsers.username,
			passwordHash: adminUsers.passwordHash
		})
		.from(adminUsers)
		.where(eq(adminUsers.username, username))
		.limit(1);
	const row = rows[0];
	if (!row) {
		// 사용자 없음도 같은 시간이 걸리게
		await verifyPassword(
			password,
			'scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
		);
		return null;
	}
	return (await verifyPassword(password, row.passwordHash))
		? { id: row.id, username: row.username }
		: null;
}

export async function createAdmin(db: Db, username: string, password: string): Promise<AdminUser> {
	const passwordHash = await hashPassword(password);
	const [row] = await db
		.insert(adminUsers)
		.values({ username, passwordHash })
		.returning({ id: adminUsers.id, username: adminUsers.username });
	return row;
}
