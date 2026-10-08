import { redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import {
	SESSION_COOKIE,
	findAdminById,
	getSessionSecret,
	readSessionToken,
	adminCount
} from '#lib/server/auth.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { ensureSetupToken } from '#lib/server/setup.ts';

async function readAdmin(token: string | undefined) {
	if (!token || !config.DATABASE_URL) return null;
	try {
		const secret = await getSessionSecret(db(), config.SESSION_SECRET);
		const session = readSessionToken(token, secret);
		return session ? await findAdminById(db(), session.sub) : null;
	} catch {
		return null;
	}
}

/** 기동 시: 관리자가 없으면 설정 토큰을 로그에 찍는다 (docker compose logs app). */
export const init: ServerInit = async () => {
	if (!config.DATABASE_URL) return;
	try {
		if ((await adminCount(db())) === 0) ensureSetupToken();
	} catch (e) {
		console.warn('[init] admin check skipped:', e instanceof Error ? e.message : e);
	}
};

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.admin = await readAdmin(event.cookies.get(SESSION_COOKIE));
	const p = event.url.pathname;
	const publicAdminPage = p === '/admin/login' || p === '/admin/setup';
	if (p.startsWith('/admin') && !publicAdminPage && !event.locals.admin) {
		redirect(303, `/admin/login?next=${encodeURIComponent(p)}`);
	}
	if (p.startsWith('/api/admin') && !event.locals.admin) {
		return new Response('unauthorized', { status: 401 });
	}
	return resolve(event);
};
