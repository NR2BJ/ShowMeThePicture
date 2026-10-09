// Source(등록한 폴더) CRUD. 경로는 항상 PHOTOS_ROOT 아래로 검증한다.
import { eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { files, pairCandidates, photos, sources } from './db/schema';
import { normalizeStem } from './stem';
import { safeResolve } from './fs';

export type SourceRole = 'original' | 'edit';
export type Medium = 'film' | 'digital';
export type Tier = 'A' | 'B';

export type NewSource = {
	name: string;
	relPath: string;
	role: SourceRole;
	medium: Medium | null;
	tier: Tier | null;
	defaultVisibility: 'public' | 'hidden';
	libraryPublic: boolean;
};

export type SourceRow = typeof sources.$inferSelect;
export type SourceWithCounts = SourceRow & {
	fileCount: number;
	indexedCount: number;
	missingCount: number;
	failedCount: number;
	pendingCount: number;
};

export function slugify(name: string): string {
	const s = name
		.normalize('NFC')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '');
	return s || 'source';
}

async function uniqueSlug(db: Db, base: string): Promise<string> {
	const rows = await db.select({ slug: sources.slug }).from(sources);
	const taken = new Set(rows.map((r) => r.slug));
	if (!taken.has(base)) return base;
	for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export async function createSource(
	db: Db,
	photosRoot: string,
	input: NewSource
): Promise<SourceRow> {
	const rootPath = safeResolve(photosRoot, input.relPath);
	const slug = await uniqueSlug(db, slugify(input.name));
	const [row] = await db
		.insert(sources)
		.values({
			slug,
			name: input.name,
			rootPath,
			role: input.role,
			medium: input.medium,
			tier: input.role === 'edit' ? input.tier : null,
			defaultVisibility: input.defaultVisibility,
			libraryPublic: input.libraryPublic
		})
		.returning();
	return row;
}

export async function listSources(db: Db): Promise<SourceRow[]> {
	return db.select().from(sources).orderBy(sources.createdAt);
}

export async function listSourcesWithCounts(db: Db): Promise<SourceWithCounts[]> {
	const rows = await db.execute(sql`
		select s.*,
		       count(f.id)::int                                             as file_count,
		       count(f.id) filter (where f.derivatives_ready)::int           as indexed_count,
		       count(f.id) filter (where f.status = 'missing')::int          as missing_count,
		       count(f.id) filter (where f.process_error is not null)::int   as failed_count,
		       count(f.id) filter (where f.status = 'active' and not f.derivatives_ready and f.process_error is null)::int as pending_count
		from sources s
		left join files f on f.source_id = s.id
		group by s.id
		order by s.created_at`);
	return (rows as unknown as Record<string, unknown>[]).map((r) => ({
		id: r.id as string,
		slug: r.slug as string,
		name: r.name as string,
		rootPath: r.root_path as string,
		role: r.role as SourceRole,
		medium: (r.medium as Medium | null) ?? null,
		tier: (r.tier as Tier | null) ?? null,
		defaultVisibility: r.default_visibility as 'public' | 'hidden',
		libraryPublic: r.library_public as boolean,
		pollIntervalMin: r.poll_interval_min as number,
		lastScannedAt: (r.last_scanned_at as Date | null) ?? null,
		createdAt: r.created_at as Date,
		updatedAt: r.updated_at as Date,
		fileCount: Number(r.file_count),
		indexedCount: Number(r.indexed_count),
		missingCount: Number(r.missing_count),
		failedCount: Number(r.failed_count),
		pendingCount: Number(r.pending_count)
	}));
}

/** 최근 처리 실패 (대시보드) */
export async function recentFailures(
	db: Db,
	limit = 10
): Promise<{ id: string; filename: string; relPath: string; source: string; error: string }[]> {
	const rows = await db
		.select({
			id: files.id,
			filename: files.filename,
			relPath: files.relPathNfc,
			source: sources.name,
			error: files.processError
		})
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(sql`${files.processError} is not null`)
		.orderBy(sql`${files.updatedAt} desc`)
		.limit(limit);
	return rows.map((r) => ({ ...r, error: r.error ?? '' }));
}

export async function getSourceBySlug(db: Db, slug: string): Promise<SourceRow | null> {
	const rows = await db.select().from(sources).where(eq(sources.slug, slug)).limit(1);
	return rows[0] ?? null;
}

export async function getSourceById(db: Db, id: string): Promise<SourceRow | null> {
	const rows = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
	return rows[0] ?? null;
}

export type SourcePatch = {
	name?: string;
	medium?: Medium | null;
	tier?: Tier | null;
	defaultVisibility?: 'public' | 'hidden';
	libraryPublic?: boolean;
	pollIntervalMin?: number;
};

export async function updateSource(db: Db, id: string, patch: SourcePatch): Promise<void> {
	await db
		.update(sources)
		.set({ ...patch, updatedAt: new Date() })
		.where(eq(sources.id, id));
}

/**
 * 역할(원본/보정)·매체·컷을 바꾼다. 역할이 바뀌면 파일 묶음(RAW+JPG / 보정본)과 페어링을 전부 다시 계산해야 하므로
 * 파일을 사진에서 떼고 stem/라벨을 다시 계산한 뒤 relink 잡(워커)이 다시 붙인다. 파생본은 그대로 둔다.
 */
export async function changeSourceRole(
	db: Db,
	id: string,
	role: SourceRole,
	medium: Medium | null,
	tier: Tier | null
): Promise<{ relinkNeeded: boolean; fileCount: number }> {
	const src = await getSourceById(db, id);
	if (!src) return { relinkNeeded: false, fileCount: 0 };
	const roleChanged = src.role !== role;
	await db
		.update(sources)
		.set({ role, medium, tier: role === 'edit' ? tier : null, updatedAt: new Date() })
		.where(eq(sources.id, id));
	const rows = await db
		.select({ id: files.id, stem: files.stem, photoId: files.photoId })
		.from(files)
		.where(eq(files.sourceId, id));
	if (roleChanged) {
		const allowLabel = role === 'edit';
		const photoIds = new Set<string>();
		for (const f of rows) {
			const { base, label } = normalizeStem(f.stem, allowLabel);
			await db
				.update(files)
				.set({
					stemNorm: base,
					editLabel: allowLabel ? label : null,
					photoId: null,
					variantRole: null,
					variantLabel: null,
					updatedAt: new Date()
				})
				.where(eq(files.id, f.id));
			if (f.photoId) photoIds.add(f.photoId);
		}
		const ids = rows.map((r) => r.id);
		for (let i = 0; i < ids.length; i += 500)
			await db
				.delete(pairCandidates)
				.where(
					sql`${pairCandidates.editFileId} in ${ids.slice(i, i + 500)} or ${pairCandidates.originalFileId} in ${ids.slice(i, i + 500)}`
				);
		// 파일이 하나도 안 남은 사진 정리, 남은 사진은 primary/original 재계산을 relink 에서
		await db.execute(
			sql`delete from ${photos} p where not exists (select 1 from ${files} f where f.photo_id = p.id)`
		);
		for (const pid of photoIds)
			await db.execute(sql`update ${photos} set updated_at = now() where id = ${pid}`);
	} else {
		// 매체/컷만 바뀐 경우: 이 폴더 파일이 원본(또는 primary)인 사진의 medium 갱신, 보정 폴더 tier 는 사진 tier 재계산
		await db.execute(sql`
			update ${photos} p set medium = ${medium}, updated_at = now()
			from ${files} f where f.id = coalesce(p.original_file_id, p.primary_file_id) and f.source_id = ${id}`);
		if (role === 'edit') {
			await db.execute(sql`
				update ${photos} p set tier = sub.tier, updated_at = now()
				from (
					select f.photo_id, max(s.tier) as tier
					from ${files} f join ${sources} s on s.id = f.source_id
					where f.variant_role = 'edit' and f.status = 'active'
					group by f.photo_id
				) sub where sub.photo_id = p.id and exists (select 1 from ${files} f2 where f2.photo_id = p.id and f2.source_id = ${id})`);
		}
	}
	return { relinkNeeded: roleChanged, fileCount: rows.length };
}

/** Source 삭제: files 는 cascade, 파일이 하나도 안 남은 photos 는 정리. 원본 디스크는 건드리지 않는다. */
export async function deleteSource(db: Db, id: string): Promise<void> {
	await db.delete(sources).where(eq(sources.id, id));
	await db.execute(
		sql`delete from ${photos} p where not exists (select 1 from ${files} f where f.photo_id = p.id)`
	);
}
