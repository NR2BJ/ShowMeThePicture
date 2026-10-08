// Source(등록한 폴더) CRUD. 경로는 항상 PHOTOS_ROOT 아래로 검증한다.
import { eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { files, photos, sources } from './db/schema';
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
		       count(f.id) filter (where f.status = 'missing')::int          as missing_count
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
		missingCount: Number(r.missing_count)
	}));
}

export async function getSourceBySlug(db: Db, slug: string): Promise<SourceRow | null> {
	const rows = await db.select().from(sources).where(eq(sources.slug, slug)).limit(1);
	return rows[0] ?? null;
}

export async function getSourceById(db: Db, id: string): Promise<SourceRow | null> {
	const rows = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
	return rows[0] ?? null;
}

/** Source 삭제: files 는 cascade, 파일이 하나도 안 남은 photos 는 정리. 원본 디스크는 건드리지 않는다. */
export async function deleteSource(db: Db, id: string): Promise<void> {
	await db.delete(sources).where(eq(sources.id, id));
	await db.execute(
		sql`delete from ${photos} p where not exists (select 1 from ${files} f where f.photo_id = p.id)`
	);
}
