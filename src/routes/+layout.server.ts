import { config } from '#lib/server/config.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => ({
	site: { title: config.SITE_TITLE }
});
