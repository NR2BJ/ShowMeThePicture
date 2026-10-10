import type { Frame } from '#lib/types.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { getLandingFrames } from '#lib/server/photos.ts';
import { getSetting } from '#lib/server/settings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	let frames: Frame[] = [];
	let dbError: string | null = null;
	let stripVh = 21;
	try {
		frames = await getLandingFrames(42);
		if (config.DATABASE_URL) stripVh = await getSetting<number>(db(), 'landing_strip_vh', 21);
	} catch (e) {
		// DB 가 없거나(로컬 개발) 아직 사진이 없어도 랜딩은 떠야 한다.
		dbError = e instanceof Error ? e.message : String(e);
	}
	return { frames, dbError, stripVh: Math.min(32, Math.max(12, Number(stripVh) || 21)) };
};
