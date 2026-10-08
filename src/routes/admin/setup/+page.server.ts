import { fail, redirect } from '@sveltejs/kit';
import {
	adminCount,
	createAdmin,
	createSessionToken,
	getSessionSecret,
	setSessionCookie
} from '#lib/server/auth.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!config.DATABASE_URL) redirect(303, '/admin/login');
	if ((await adminCount(db())) > 0) redirect(303, '/admin/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		if ((await adminCount(db())) > 0) redirect(303, '/admin/login');
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');
		if (!/^[a-z0-9_-]{3,32}$/i.test(username))
			return fail(400, { error: '아이디는 영문·숫자·_·- 3~32자', username });
		if (password.length < 8) return fail(400, { error: '비밀번호는 8자 이상', username });
		if (password !== confirm) return fail(400, { error: '비밀번호 확인이 다릅니다', username });
		const user = await createAdmin(db(), username, password);
		const secret = await getSessionSecret(db(), config.SESSION_SECRET);
		setSessionCookie(cookies, createSessionToken(user.id, secret), url.protocol === 'https:');
		redirect(303, '/admin/sources');
	}
};
