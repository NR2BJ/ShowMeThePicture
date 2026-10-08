import { redirect } from '@sveltejs/kit';
import { clearSessionCookie } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	redirect(303, '/admin');
};

export const actions: Actions = {
	default: async ({ cookies }) => {
		clearSessionCookie(cookies);
		redirect(303, '/');
	}
};
