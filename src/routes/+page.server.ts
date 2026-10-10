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
	let stripRows = 3;
	try {
		if (config.DATABASE_URL) {
			stripVh = await getSetting<number>(db(), 'landing_strip_vh', 21);
			stripRows = await getSetting<number>(db(), 'landing_rows', 3);
		}
		stripRows = Math.min(10, Math.max(1, Number(stripRows) || 3));
		frames = await getLandingFrames(Math.max(42, stripRows * 14));
	} catch (e) {
		// DB 가 없거나(로컬 개발) 아직 사진이 없어도 랜딩은 떠야 한다.
		dbError = e instanceof Error ? e.message : String(e);
	}
	return {
		frames,
		dbError,
		stripVh: Math.min(50, Math.max(5, Number(stripVh) || 21)),
		stripRows: Math.min(10, Math.max(1, Number(stripRows) || 3))
	};
};
