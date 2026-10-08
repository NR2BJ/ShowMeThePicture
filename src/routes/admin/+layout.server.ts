import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => ({
	admin: locals.admin ? { username: locals.admin.username } : null
});
