// 관리자 회전 저장: files.rotation 갱신 → 가로세로 교환 → 파생본 삭제(즉석 재생성됨) → 워커 재처리(thumbhash 등).
import { eq } from 'drizzle-orm';
import { config } from './config';
import type { Db } from './db';
import { files } from './db/schema';
import { removeDerivatives } from './derivefs';
import { enqueueProcess } from './queue';

export async function setFileRotation(db: Db, fileId: string, rotation: number): Promise<void> {
	const r = ((rotation % 4) + 4) % 4;
	const [f] = await db
		.select({ rotation: files.rotation, width: files.width, height: files.height })
		.from(files)
		.where(eq(files.id, fileId))
		.limit(1);
	if (!f) return;
	const swap = f.rotation % 2 !== r % 2;
	await db
		.update(files)
		.set({
			rotation: r,
			width: swap ? f.height : f.width,
			height: swap ? f.width : f.height,
			updatedAt: new Date()
		})
		.where(eq(files.id, fileId));
	await removeDerivatives(config.CACHE_DIR, fileId);
	await enqueueProcess(fileId);
}
