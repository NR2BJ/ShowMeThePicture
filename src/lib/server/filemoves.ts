// 파일 이동·삭제 처리. 폴더 사이에서 파일을 옮기면(copyparty 등) 스캐너는 "옛 경로 없어짐 + 새 경로 생김"으로 본다.
//  - 새 파일을 처리할 때 내용 지문(sha256)이 같은 파일이 이미 있고 그 파일이 디스크에 없으면 → 옮긴 것: 옛 사진에 이어 붙이고
//    방향(rotation)을 넘겨받은 뒤 옛 파일 기록을 지운다. 사진에 해 둔 공개·컷·컬렉션은 사진에 붙어 있어 그대로 남는다.
//    새 폴더 스캔이 옛 폴더 스캔보다 먼저 돌아도 맞도록 DB 상태가 아니라 실제 디스크를 확인한다.
//  - 스캔에서 파일이 사라지면 그 사진을 남은 파일로 다시 계산하고, 오래(30일) 사라진 파일은 기록·캐시를 정리한다.
import { access } from 'node:fs/promises';
import path from 'node:path';
import { and, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import type { Db } from './db';
import { files, photos, sources } from './db/schema';
import { removeDerivatives } from './derivefs';
import { recalcPhoto } from './pairing';

export const PURGE_MISSING_DAYS = 30;

const exists = (p: string) =>
	access(p).then(
		() => true,
		() => false
	);

export type MovedTwin = { id: string; photoId: string | null; rotation: number };

/** 새 파일과 내용이 같은데 디스크에서 사라진 파일(옮기기 전 기록). 사진에 붙어 있던 것을 먼저 고른다. */
export async function findMovedTwin(
	db: Db,
	fileId: string,
	contentHash: string
): Promise<MovedTwin | null> {
	const rows = await db
		.select({
			id: files.id,
			photoId: files.photoId,
			rotation: files.rotation,
			status: files.status,
			relPath: files.relPath,
			rootPath: sources.rootPath
		})
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(
			and(
				eq(files.contentHash, contentHash),
				ne(files.id, fileId),
				inArray(files.status, ['active', 'missing'])
			)
		);
	const gone: MovedTwin[] = [];
	for (const r of rows) {
		// 복사본(옛 파일이 아직 있음)은 옮긴 게 아니다
		if (await exists(path.join(r.rootPath, r.relPath))) continue;
		gone.push({ id: r.id, photoId: r.photoId, rotation: r.rotation });
	}
	return gone.find((g) => g.photoId) ?? gone[0] ?? null;
}

/** 옮긴 파일 처리: 새 파일이 옛 파일의 사진·방향을 넘겨받고 옛 기록은 지운다. 새 파일의 사진 id 를 돌려준다. */
export async function adoptMovedTwin(
	db: Db,
	cacheDir: string,
	fileId: string,
	twin: MovedTwin,
	variant: { role: 'original' | 'edit'; label: string }
): Promise<string | null> {
	await db
		.update(files)
		.set({
			rotation: twin.rotation,
			photoId: twin.photoId,
			variantRole: twin.photoId ? variant.role : null,
			variantLabel: twin.photoId ? variant.label : null,
			updatedAt: new Date()
		})
		.where(eq(files.id, fileId));
	await db.delete(files).where(eq(files.id, twin.id));
	await removeDerivatives(cacheDir, twin.id);
	return twin.photoId;
}

/** 스캔에서 사라진 파일들의 사진을 남은 파일로 다시 계산 (보정본이 지워지면 원본으로, 컷·공개 기본값도 다시) */
export async function refreshPhotosOfFiles(db: Db, fileIds: string[]): Promise<number> {
	if (fileIds.length === 0) return 0;
	const rows = await db
		.selectDistinct({ photoId: files.photoId })
		.from(files)
		.where(and(inArray(files.id, fileIds), sql`${files.photoId} is not null`));
	for (const r of rows) await recalcPhoto(db, r.photoId!, { revisitVisibility: true });
	return rows.length;
}

/** 오래 사라진 파일의 기록·캐시 정리. 파일이 하나도 안 남은 사진도 지운다. */
export async function purgeLongMissing(
	db: Db,
	cacheDir: string,
	sourceId: string
): Promise<number> {
	const old = await db
		.select({ id: files.id, photoId: files.photoId })
		.from(files)
		.where(
			and(
				eq(files.sourceId, sourceId),
				eq(files.status, 'missing'),
				lt(files.updatedAt, sql`now() - make_interval(days => ${PURGE_MISSING_DAYS})`)
			)
		);
	if (old.length === 0) return 0;
	const ids = old.map((o) => o.id);
	const photoIds = [...new Set(old.map((o) => o.photoId).filter((x): x is string => !!x))];
	for (let i = 0; i < ids.length; i += 500)
		await db.delete(files).where(inArray(files.id, ids.slice(i, i + 500)));
	for (const id of ids) await removeDerivatives(cacheDir, id);
	for (const pid of photoIds) {
		const [left] = await db
			.select({ n: sql<number>`count(*)::int` })
			.from(files)
			.where(eq(files.photoId, pid));
		if (Number(left?.n ?? 0) === 0) await db.delete(photos).where(eq(photos.id, pid));
		else await recalcPhoto(db, pid, { revisitVisibility: true });
	}
	return ids.length;
}
