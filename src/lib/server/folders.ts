// 폴더(롤/세션) 메타. 필름 스캔처럼 EXIF 가 없는 파일에 날짜·카메라·필름 정보를 폴더 단위로 준다.
import path from 'node:path';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from './db';
import { files, folderMeta, photos, sources } from './db/schema';
import { listGear, toItems } from './gear';
import { parseRollFolder } from './stem';

export type FolderMetaRow = typeof folderMeta.$inferSelect;
export type RollInfo = {
	title: string | null;
	relDir: string;
	developedAt: string | null;
	rollNo: number | null;
	camera: string | null;
	lens: string | null;
	filmStock: string | null;
	filmFormat: string | null;
	scanner: string | null;
	notes: string | null;
};

type SourceRow = typeof sources.$inferSelect;

/**
 * 스캔 때 호출. 파일이 있는 폴더마다 folder_meta 행이 없으면 만든다.
 * 필름 source 는 모든 폴더, 그 외는 롤 규칙(YYMM_RR …)에 맞는 폴더만. 이미 있는 행은 건드리지 않는다.
 */
export async function ensureFolderMeta(
	db: Db,
	source: SourceRow,
	relDirs: Iterable<string>
): Promise<number> {
	const existing = await db
		.select({ relDir: folderMeta.relDir })
		.from(folderMeta)
		.where(eq(folderMeta.sourceId, source.id));
	const have = new Set(existing.map((r) => r.relDir));
	const items = toItems(await listGear(db));
	const rows: (typeof folderMeta.$inferInsert)[] = [];
	for (const dir of relDirs) {
		if (have.has(dir)) continue;
		const name = path.posix.basename(dir) || source.name;
		const parsed = parseRollFolder(name, items);
		const isRoll = parsed.developedAt !== null;
		if (!isRoll && source.medium !== 'film') continue;
		rows.push({
			sourceId: source.id,
			relDir: dir,
			title: parsed.label || name,
			developedAt: parsed.developedAt,
			rollNo: parsed.rollNo,
			camera: parsed.camera,
			lens: parsed.lens,
			filmStock: parsed.filmStock
		});
		have.add(dir);
	}
	if (rows.length) await db.insert(folderMeta).values(rows).onConflictDoNothing();
	// 현상월이 파싱된 새 롤은 바로 날짜를 맞춘다 (EXIF 없는 스캔이 mtime 으로 보이지 않게)
	for (const r of rows) if (r.developedAt) await applyFolderDates(db, source.id, r.relDir);
	return rows.length;
}

/** 파일 경로에서 가장 가까운 상위 폴더의 메타 (가장 긴 rel_dir 접두 일치). */
export function pickFolderMeta(rows: FolderMetaRow[], relPath: string): FolderMetaRow | null {
	const dir = path.posix.dirname(relPath);
	let best: FolderMetaRow | null = null;
	for (const r of rows) {
		if (r.relDir === '' || r.relDir === '.' || dir === r.relDir || dir.startsWith(r.relDir + '/')) {
			if (!best || r.relDir.length > best.relDir.length) best = r;
		}
	}
	return best;
}

export async function folderMetaForSource(db: Db, sourceId: string): Promise<FolderMetaRow[]> {
	return db.select().from(folderMeta).where(eq(folderMeta.sourceId, sourceId));
}

export function toRollInfo(r: FolderMetaRow): RollInfo {
	return {
		title: r.title,
		relDir: r.relDir,
		developedAt: r.developedAt,
		rollNo: r.rollNo,
		camera: r.camera,
		lens: r.lens,
		filmStock: r.filmStock,
		filmFormat: r.filmFormat,
		scanner: r.scanner,
		notes: r.notes
	};
}

/**
 * 폴더의 developed_at 을 그 아래 파일들의 촬영시각으로 준다 (수동으로 정한 날짜만 제외).
 * 롤 안 순서를 지키려고 파일명 순으로 1분씩 더한다.
 */
export async function applyFolderDates(db: Db, sourceId: string, relDir: string): Promise<number> {
	const [meta] = await db
		.select()
		.from(folderMeta)
		.where(and(eq(folderMeta.sourceId, sourceId), eq(folderMeta.relDir, relDir)))
		.limit(1);
	if (!meta?.developedAt) return 0;
	const under = await db
		.select({
			id: files.id,
			relPath: files.relPath,
			src: files.takenAtSource,
			photoId: files.photoId
		})
		.from(files)
		.where(eq(files.sourceId, sourceId));
	const targets = under
		.filter((f) => {
			const d = path.posix.dirname(f.relPath);
			const inDir = relDir === '' ? true : d === relDir || d.startsWith(relDir + '/');
			// 스캐너가 넣은 EXIF 날짜(스캔일)도 덮어쓴다. 관리자가 직접 정한 날짜(manual)만 남긴다.
			return inDir && f.src !== 'manual';
		})
		.sort((a, b) => a.relPath.localeCompare(b.relPath, undefined, { numeric: true }));
	const base = new Date(meta.developedAt + 'T12:00:00');
	let i = 0;
	const photoIds = new Set<string>();
	for (const f of targets) {
		const t = new Date(base.getTime() + i++ * 60_000);
		await db
			.update(files)
			.set({ takenAt: t, takenAtSource: 'roll', updatedAt: new Date() })
			.where(eq(files.id, f.id));
		if (f.photoId) photoIds.add(f.photoId);
	}
	if (photoIds.size) {
		const ids = [...photoIds];
		await db.execute(sql`
			update ${photos} p set taken_at = f.taken_at, updated_at = now()
			from ${files} f
			where f.id = coalesce(p.original_file_id, p.primary_file_id) and p.id in ${ids}`);
	}
	return targets.length;
}

/** 등록된 장비로 폴더명을 다시 파싱해 비어 있는 칸만 채운다 (관리자가 입력한 값은 보존). */
export async function reparseFolderMeta(db: Db): Promise<number> {
	const items = toItems(await listGear(db));
	const rows = await db.select().from(folderMeta);
	let n = 0;
	for (const r of rows) {
		const parsed = parseRollFolder(path.posix.basename(r.relDir) || '', items);
		const patch: Partial<typeof folderMeta.$inferInsert> = {};
		if (!r.camera && parsed.camera) patch.camera = parsed.camera;
		if (!r.lens && parsed.lens) patch.lens = parsed.lens;
		if (!r.filmStock && parsed.filmStock) patch.filmStock = parsed.filmStock;
		if (!r.developedAt && parsed.developedAt) patch.developedAt = parsed.developedAt;
		if (r.rollNo == null && parsed.rollNo != null) patch.rollNo = parsed.rollNo;
		if (Object.keys(patch).length) {
			await db
				.update(folderMeta)
				.set({ ...patch, updatedAt: new Date() })
				.where(eq(folderMeta.id, r.id));
			if (patch.developedAt) await applyFolderDates(db, r.sourceId, r.relDir);
			n++;
		}
	}
	return n;
}

/** 현상월이 있는 모든 폴더에 날짜를 다시 적용 */
export async function applyAllFolderDates(db: Db): Promise<{ folders: number; files: number }> {
	const rows = await db
		.select({
			sourceId: folderMeta.sourceId,
			relDir: folderMeta.relDir,
			developedAt: folderMeta.developedAt
		})
		.from(folderMeta);
	let folders = 0;
	let files = 0;
	for (const r of rows) {
		if (!r.developedAt) continue;
		files += await applyFolderDates(db, r.sourceId, r.relDir);
		folders++;
	}
	return { folders, files };
}

export async function updateFolderMeta(
	db: Db,
	id: string,
	patch: Partial<RollInfo>
): Promise<FolderMetaRow | null> {
	const [row] = await db
		.update(folderMeta)
		.set({
			title: patch.title ?? null,
			developedAt: patch.developedAt ?? null,
			rollNo: patch.rollNo ?? null,
			camera: patch.camera ?? null,
			lens: patch.lens ?? null,
			filmStock: patch.filmStock ?? null,
			filmFormat: patch.filmFormat ?? null,
			scanner: patch.scanner ?? null,
			notes: patch.notes ?? null,
			updatedAt: new Date()
		})
		.where(eq(folderMeta.id, id))
		.returning();
	return row ?? null;
}

export async function listFolderMeta(db: Db): Promise<
	(FolderMetaRow & {
		sourceName: string;
		sourceSlug: string;
		medium: string | null;
		fileCount: number;
	})[]
> {
	const rows = await db.execute(sql`
		select m.*, s.name as source_name, s.slug as source_slug, s.medium,
		       (select count(*)::int from files f where f.source_id = m.source_id and (m.rel_dir = '' or f.rel_path like m.rel_dir || '/%')) as file_count
		from folder_meta m join sources s on s.id = m.source_id
		order by s.medium desc nulls last, s.name, m.rel_dir`);
	return (rows as unknown as Record<string, unknown>[]).map((r) => ({
		id: r.id as string,
		sourceId: r.source_id as string,
		relDir: r.rel_dir as string,
		title: (r.title as string | null) ?? null,
		developedAt: (r.developed_at as string | null) ?? null,
		rollNo: (r.roll_no as number | null) ?? null,
		camera: (r.camera as string | null) ?? null,
		lens: (r.lens as string | null) ?? null,
		filmStock: (r.film_stock as string | null) ?? null,
		filmFormat: (r.film_format as string | null) ?? null,
		scanner: (r.scanner as string | null) ?? null,
		notes: (r.notes as string | null) ?? null,
		createdAt: r.created_at as Date,
		updatedAt: r.updated_at as Date,
		sourceName: r.source_name as string,
		sourceSlug: r.source_slug as string,
		medium: (r.medium as string | null) ?? null,
		fileCount: Number(r.file_count)
	}));
}

export { inArray };
