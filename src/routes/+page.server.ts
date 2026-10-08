import type { Frame } from '#lib/types.ts';
import { getLandingFrames } from '#lib/server/photos.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	let frames: Frame[] = [];
	let dbError: string | null = null;
	try {
		frames = await getLandingFrames(42);
	} catch (e) {
		// DB 가 없거나(로컬 개발) 아직 사진이 없어도 랜딩은 떠야 한다.
		dbError = e instanceof Error ? e.message : String(e);
	}
	return { frames, dbError };
};
