import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import {
	SESSION_COOKIE,
	findAdminById,
	getSessionSecret,
	readSessionToken
} from '#lib/server/auth.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';

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
