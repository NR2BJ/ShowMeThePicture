import { fail, redirect } from '@sveltejs/kit';
import {
	adminCount,
	authenticate,
	createSessionToken,
	getSessionSecret,
	setSessionCookie
} from '#lib/server/auth.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { hit, isLimited, reset } from '#lib/server/ratelimit.ts';
import type { Actions, PageServerLoad } from './$types';

function safeNext(v: FormDataEntryValue | string | null): string {
	const s = typeof v === 'string' ? v : '';
	return s.startsWith('/') && !s.startsWith('//') ? s : '/admin';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.admin) redirect(303, '/admin');
	if (!config.DATABASE_URL) return { next: '/admin', noDb: true };
	if ((await adminCount(db())) === 0) redirect(303, '/admin/setup');
	return { next: safeNext(url.searchParams.get('next')), noDb: false };
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		let key = 'login:unknown';
		try {
			key = `login:${getClientAddress()}`;
		} catch {
			/* 주소를 못 얻으면 공용 버킷 */
		}
		if (isLimited(key, 10))
			return fail(429, {
				error: '로그인 시도가 너무 많습니다. 10분 뒤에 다시 하세요',
				username: ''
			});
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const next = safeNext(form.get('next'));
		if (!username || !password)
			return fail(400, { error: '아이디와 비밀번호를 입력하세요', username });
		const user = await authenticate(db(), username, password);
		if (!user) {
			hit(key, 10 * 60_000);
			return fail(400, { error: '아이디나 비밀번호가 맞지 않습니다', username });
		}
		reset(key);
		const secret = await getSessionSecret(db(), config.SESSION_SECRET);
		setSessionCookie(cookies, createSessionToken(user.id, secret), url.protocol === 'https:');
		redirect(303, next);
	}
};
