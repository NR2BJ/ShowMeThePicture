// 컬렉션: 수동(관리자가 고른 사진) / 스마트(규칙 → collection_photos 에 물질화). 깊이는 컬렉션 › 시리즈 2단계.
import path from 'node:path';
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { mediaUrl, versionOf } from '#lib/media.ts';
import type { Db } from './db';
import {
	collectionPhotos,
	collections,
	files,
	folderMeta,
	photos,
	series,
	sources
} from './db/schema';
import { pickFolderMeta } from './folders';
import type { GalleryItem } from './gallery';
import { slugify } from './sources';

export type SmartRule = {
	medium?: 'film' | 'digital';
	tier?: 'A' | 'B' | 'any';
	sourceId?: string;
	year?: number;
	/** 필름 롤(folder_meta)마다 시리즈를 만든다 */
	seriesByFolder?: boolean;
};

export type CollectionRow = typeof collections.$inferSelect;
export type CollectionSummary = {
	id: string;
	slug: string;
	title: string;
	kind: 'manual' | 'smart';
	visibility: 'public' | 'hidden';
	count: number;
	yearFrom: number | null;
	yearTo: number | null;
	cover: {
		thumb: string;
		preview: string;
		thumbhash: string | null;
		width: number;
		height: number;
	} | null;
	position: number;
};

function b64(x: Uint8Array | null | undefined): string | null {
	return x ? Buffer.from(x).toString('base64') : null;
}

export async function listCollections(db: Db, admin: boolean): Promise<CollectionSummary[]> {
	const vis = admin ? sql`` : sql`and c.visibility = 'public'`;
	const pvis = admin ? sql`` : sql`and p.visibility = 'public'`;
	const rows = (await db.execute(sql`
		select c.id, c.slug, c.title, c.kind, c.visibility, c.position, c.cover_photo_id,
		       (select count(*)::int from ${collectionPhotos} cp join ${photos} p on p.id = cp.photo_id
		        where cp.collection_id = c.id ${pvis}) as count,
		       (select extract(year from min(p.taken_at))::int from ${collectionPhotos} cp join ${photos} p on p.id = cp.photo_id where cp.collection_id = c.id ${pvis}) as year_from,
		       (select extract(year from max(p.taken_at))::int from ${collectionPhotos} cp join ${photos} p on p.id = cp.photo_id where cp.collection_id = c.id ${pvis}) as year_to,
		       (select f.id || '|' || coalesce(f.content_hash,'') || '|' || f.rotation || '|' || coalesce(f.width,3) || '|' || coalesce(f.height,2) || '|' || coalesce(encode(f.thumbhash,'base64'),'')
		          from ${photos} p join ${files} f on f.id = p.primary_file_id
		         where p.id = coalesce(c.cover_photo_id, (select cp.photo_id from ${collectionPhotos} cp join ${photos} p2 on p2.id = cp.photo_id where cp.collection_id = c.id ${pvis} order by cp.position, p2.taken_at desc limit 1))
		           and f.derivatives_ready) as cover
		from ${collections} c
		where true ${vis}
		order by c.position, c.created_at`)) as unknown as Record<string, unknown>[];
	return rows.map((r) => {
		let cover: CollectionSummary['cover'] = null;
		if (typeof r.cover === 'string' && r.cover) {
			const [id, hash, rot, w, h, th] = r.cover.split('|');
			const v = versionOf(hash || null, Number(rot));
			cover = {
				thumb: mediaUrl(id, 'thumb', v),
				preview: mediaUrl(id, 'preview', v),
				thumbhash: th || null,
				width: Number(w),
				height: Number(h)
			};
		}
		return {
			id: r.id as string,
			slug: r.slug as string,
			title: r.title as string,
			kind: r.kind as 'manual' | 'smart',
			visibility: r.visibility as 'public' | 'hidden',
			count: Number(r.count),
			yearFrom: (r.year_from as number | null) ?? null,
			yearTo: (r.year_to as number | null) ?? null,
			cover,
			position: Number(r.position)
		};
	});
}

export type CollectionDetail = {
	id: string;
	slug: string;
	title: string;
	statementMd: string | null;
	kind: 'manual' | 'smart';
	visibility: 'public' | 'hidden';
	sort: 'taken_asc' | 'taken_desc' | 'manual';
	rule: SmartRule | null;
	coverPhotoId: string | null;
	series: { id: string; title: string; position: number }[];
	items: (GalleryItem & { seriesId: string | null; position: number })[];
};

export async function getCollectionBySlug(
	db: Db,
	slug: string,
	admin: boolean
): Promise<CollectionDetail | null> {
	const [c] = await db.select().from(collections).where(eq(collections.slug, slug)).limit(1);
	if (!c) return null;
	if (c.visibility !== 'public' && !admin) return null;
	return getCollectionDetail(db, c, admin);
}

export async function getCollectionById(
	db: Db,
	id: string,
	admin: boolean
): Promise<CollectionDetail | null> {
	const [c] = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
	if (!c) return null;
	return getCollectionDetail(db, c, admin);
}

async function getCollectionDetail(
	db: Db,
	c: CollectionRow,
	admin: boolean
): Promise<CollectionDetail> {
	const ser = await db
		.select({ id: series.id, title: series.title, position: series.position })
		.from(series)
		.where(eq(series.collectionId, c.id))
		.orderBy(asc(series.position), asc(series.title));
	const conds: SQL[] = [
		eq(collectionPhotos.collectionId, c.id),
		eq(files.derivativesReady, true),
		eq(files.status, 'active')
	];
	if (!admin) conds.push(eq(photos.visibility, 'public'));
	const order =
		c.sort === 'manual'
			? [asc(collectionPhotos.position), desc(photos.takenAt)]
			: c.sort === 'taken_desc'
				? [desc(sql`coalesce(${photos.takenAt}, 'epoch'::timestamptz)`), desc(photos.id)]
				: [asc(sql`coalesce(${photos.takenAt}, 'epoch'::timestamptz)`), asc(photos.id)];
	const rows = await db
		.select({
			id: photos.id,
			takenAt: photos.takenAt,
			tier: photos.tier,
			medium: photos.medium,
			visibility: photos.visibility,
			fileId: files.id,
			width: files.width,
			height: files.height,
			thumbhash: files.thumbhash,
			contentHash: files.contentHash,
			rotation: files.rotation,
			camera: files.cameraModel,
			seriesId: collectionPhotos.seriesId,
			position: collectionPhotos.position
		})
		.from(collectionPhotos)
		.innerJoin(photos, eq(photos.id, collectionPhotos.photoId))
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.where(and(...conds))
		.orderBy(...order);
	const items = rows.map((r) => {
		const v = versionOf(r.contentHash, r.rotation);
		return {
			id: r.id,
			takenAt: r.takenAt ? r.takenAt.toISOString() : null,
			tier: r.tier,
			medium: r.medium,
			visibility: r.visibility,
			width: r.width ?? 3,
			height: r.height ?? 2,
			thumbhash: b64(r.thumbhash),
			thumb: mediaUrl(r.fileId, 'thumb', v),
			preview: mediaUrl(r.fileId, 'preview', v),
			camera: r.camera,
			seriesId: r.seriesId,
			position: r.position
		};
	});
	return {
		id: c.id,
		slug: c.slug,
		title: c.title,
		statementMd: c.statementMd,
		kind: c.kind,
		visibility: c.visibility,
		sort: c.sort,
		rule: (c.rule as SmartRule | null) ?? null,
		coverPhotoId: c.coverPhotoId,
		series: ser,
		items
	};
}

export type NewCollection = {
	title: string;
	statementMd: string | null;
	kind: 'manual' | 'smart';
	visibility: 'public' | 'hidden';
	sort: 'taken_asc' | 'taken_desc' | 'manual';
	rule: SmartRule | null;
};

export async function createCollection(db: Db, input: NewCollection): Promise<CollectionRow> {
	const base = slugify(input.title);
	const existing = await db.select({ slug: collections.slug }).from(collections);
	const taken = new Set(existing.map((r) => r.slug));
	let slug = base;
	for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
	const [{ max }] = await db
		.select({ max: sql<number>`coalesce(max(${collections.position}), 0)::int` })
		.from(collections);
	const [row] = await db
		.insert(collections)
		.values({
			slug,
			title: input.title,
			statementMd: input.statementMd,
			kind: input.kind,
			visibility: input.visibility,
			sort: input.sort,
			rule: input.rule,
			position: Number(max) + 1
		})
		.returning();
	if (input.kind === 'smart') await rebuildSmartCollection(db, row.id);
	return row;
}

export async function updateCollection(
	db: Db,
	id: string,
	patch: Partial<NewCollection> & { coverPhotoId?: string | null }
): Promise<void> {
	await db
		.update(collections)
		.set({ ...patch, updatedAt: new Date() })
		.where(eq(collections.id, id));
	const [c] = await db
		.select({ kind: collections.kind })
		.from(collections)
		.where(eq(collections.id, id))
		.limit(1);
	if (c?.kind === 'smart') await rebuildSmartCollection(db, id);
}

export async function deleteCollection(db: Db, id: string): Promise<void> {
	await db.delete(collections).where(eq(collections.id, id));
}

export async function addPhotoToCollection(
	db: Db,
	collectionId: string,
	photoId: string
): Promise<void> {
	const [{ max }] = await db
		.select({ max: sql<number>`coalesce(max(${collectionPhotos.position}), 0)::int` })
		.from(collectionPhotos)
		.where(eq(collectionPhotos.collectionId, collectionId));
	await db
		.insert(collectionPhotos)
		.values({ collectionId, photoId, position: Number(max) + 1 })
		.onConflictDoNothing();
}

export async function removePhotoFromCollection(
	db: Db,
	collectionId: string,
	photoId: string
): Promise<void> {
	await db
		.delete(collectionPhotos)
		.where(
			and(eq(collectionPhotos.collectionId, collectionId), eq(collectionPhotos.photoId, photoId))
		);
}

/** 수동 정렬: 위/아래로 한 칸 */
export async function movePhotoInCollection(
	db: Db,
	collectionId: string,
	photoId: string,
	dir: 'up' | 'down'
): Promise<void> {
	const rows = await db
		.select({ photoId: collectionPhotos.photoId })
		.from(collectionPhotos)
		.where(eq(collectionPhotos.collectionId, collectionId))
		.orderBy(asc(collectionPhotos.position));
	const ids = rows.map((r) => r.photoId);
	const i = ids.indexOf(photoId);
	if (i < 0) return;
	const j = dir === 'up' ? i - 1 : i + 1;
	if (j < 0 || j >= ids.length) return;
	[ids[i], ids[j]] = [ids[j], ids[i]];
	for (let k = 0; k < ids.length; k++) {
		await db
			.update(collectionPhotos)
			.set({ position: k + 1 })
			.where(
				and(eq(collectionPhotos.collectionId, collectionId), eq(collectionPhotos.photoId, ids[k]))
			);
	}
}

/** 관리자가 수동 컬렉션에 넣을 수 있는 목록 */
export async function manualCollections(db: Db): Promise<{ id: string; title: string }[]> {
	return db
		.select({ id: collections.id, title: collections.title })
		.from(collections)
		.where(eq(collections.kind, 'manual'))
		.orderBy(asc(collections.position));
}

/** 스마트 규칙 → 멤버를 다시 계산해 collection_photos / series 를 물질화한다. */
export async function rebuildSmartCollection(db: Db, collectionId: string): Promise<number> {
	const [c] = await db.select().from(collections).where(eq(collections.id, collectionId)).limit(1);
	if (!c || c.kind !== 'smart') return 0;
	const rule = (c.rule as SmartRule | null) ?? {};
	const conds: SQL[] = [eq(files.derivativesReady, true), eq(files.status, 'active')];
	if (rule.medium) conds.push(eq(photos.medium, rule.medium));
	if (rule.tier && rule.tier !== 'any') conds.push(eq(photos.tier, rule.tier));
	if (rule.year) conds.push(sql`extract(year from ${photos.takenAt}) = ${rule.year}`);
	if (rule.sourceId)
		conds.push(
			sql`exists (select 1 from ${files} f2 where f2.photo_id = ${photos.id} and f2.source_id = ${rule.sourceId})`
		);
	const members = await db
		.select({
			id: photos.id,
			takenAt: photos.takenAt,
			originalId: photos.originalFileId,
			primaryId: photos.primaryFileId
		})
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.where(and(...conds))
		.orderBy(desc(sql`coalesce(${photos.takenAt}, 'epoch'::timestamptz)`));

	// 시리즈: 원본(없으면 primary) 변형이 속한 폴더의 folder_meta
	const seriesIdByKey = new Map<string, string>();
	await db.delete(series).where(eq(series.collectionId, collectionId));
	const assignment = new Map<string, string | null>();
	if (rule.seriesByFolder && members.length) {
		const fileIds = members.map((m) => m.originalId ?? m.primaryId).filter((x): x is string => !!x);
		const frows = fileIds.length
			? await db
					.select({ id: files.id, sourceId: files.sourceId, relPath: files.relPath })
					.from(files)
					.where(inArray(files.id, fileIds))
			: [];
		const byFile = new Map(frows.map((f) => [f.id, f]));
		const metaCache = new Map<string, (typeof folderMeta.$inferSelect)[]>();
		const seriesDefs = new Map<
			string,
			{ title: string; relDir: string; developedAt: string | null }
		>();
		for (const m of members) {
			const f = byFile.get(m.originalId ?? m.primaryId ?? '');
			if (!f) {
				assignment.set(m.id, null);
				continue;
			}
			if (!metaCache.has(f.sourceId))
				metaCache.set(
					f.sourceId,
					await db.select().from(folderMeta).where(eq(folderMeta.sourceId, f.sourceId))
				);
			const fm = pickFolderMeta(metaCache.get(f.sourceId)!, f.relPath);
			if (!fm) {
				assignment.set(m.id, null);
				continue;
			}
			const key = `${f.sourceId}:${fm.relDir}`;
			if (!seriesDefs.has(key))
				seriesDefs.set(key, {
					title: fm.title ?? path.posix.basename(fm.relDir),
					relDir: fm.relDir,
					developedAt: fm.developedAt
				});
			assignment.set(m.id, key);
		}
		const defs = [...seriesDefs.entries()].sort((a, b) =>
			(b[1].developedAt ?? '').localeCompare(a[1].developedAt ?? '')
		);
		let pos = 0;
		for (const [key, d] of defs) {
			const [row] = await db
				.insert(series)
				.values({ collectionId, title: d.title, relDir: d.relDir, position: pos++ })
				.returning({ id: series.id });
			seriesIdByKey.set(key, row.id);
		}
	}

	await db.delete(collectionPhotos).where(eq(collectionPhotos.collectionId, collectionId));
	if (members.length) {
		const values = members.map((m, i) => ({
			collectionId,
			photoId: m.id,
			seriesId: assignment.get(m.id) ? (seriesIdByKey.get(assignment.get(m.id)!) ?? null) : null,
			position: i + 1
		}));
		for (let i = 0; i < values.length; i += 500)
			await db.insert(collectionPhotos).values(values.slice(i, i + 500));
	}
	return members.length;
}

export async function rebuildAllSmart(db: Db): Promise<void> {
	const rows = await db
		.select({ id: collections.id })
		.from(collections)
		.where(eq(collections.kind, 'smart'));
	for (const r of rows) await rebuildSmartCollection(db, r.id);
}

export async function listSourcesForRules(db: Db): Promise<{ id: string; name: string }[]> {
	return db.select({ id: sources.id, name: sources.name }).from(sources).orderBy(asc(sources.name));
}
