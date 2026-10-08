// 갤러리 쿼리: 아카이브 / 라이브러리 목록, 사진 상세, 이웃(prev/next).
import { and, asc, desc, eq, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { mediaUrl, versionOf } from '#lib/media.ts';
import type { Db } from './db';
import { files, photos, sources } from './db/schema';

export type Scope = { kind: 'archive' } | { kind: 'library'; sourceId: string };
export type ListOptions = {
	scope: Scope;
	admin: boolean;
	includeB: boolean;
	page: number;
	limit: number;
};

export type GalleryItem = {
	id: string;
	takenAt: string | null;
	tier: 'A' | 'B' | null;
	medium: 'film' | 'digital' | null;
	visibility: 'public' | 'hidden';
	width: number;
	height: number;
	thumbhash: string | null;
	thumb: string;
	preview: string;
	camera: string | null;
};

function b64(x: Uint8Array | null | undefined): string | null {
	return x ? Buffer.from(x).toString('base64') : null;
}

function baseConds(o: { scope: Scope; admin: boolean; includeB: boolean }): SQL[] {
	const conds: SQL[] = [eq(files.derivativesReady, true), eq(files.status, 'active')];
	if (!o.admin) conds.push(eq(photos.visibility, 'public'));
	if (!o.includeB) conds.push(or(isNull(photos.tier), ne(photos.tier, 'B'))!);
	if (o.scope.kind === 'library') {
		conds.push(
			sql`exists (select 1 from ${files} f2 where f2.photo_id = ${photos.id} and f2.source_id = ${o.scope.sourceId})`
		);
	}
	return conds;
}

const orderKey = sql`coalesce(${photos.takenAt}, 'epoch'::timestamptz)`;

const itemSelect = {
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
	camera: files.cameraModel
};

function toItem(r: {
	id: string;
	takenAt: Date | null;
	tier: 'A' | 'B' | null;
	medium: 'film' | 'digital' | null;
	visibility: 'public' | 'hidden';
	fileId: string;
	width: number | null;
	height: number | null;
	thumbhash: Uint8Array | null;
	contentHash: string | null;
	camera: string | null;
}): GalleryItem {
	const v = versionOf(r.contentHash);
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
		camera: r.camera
	};
}

export async function listPhotos(
	db: Db,
	o: ListOptions
): Promise<{ items: GalleryItem[]; hasMore: boolean; total: number }> {
	const conds = baseConds(o);
	const rows = await db
		.select(itemSelect)
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.where(and(...conds))
		.orderBy(desc(orderKey), desc(photos.id))
		.limit(o.limit + 1)
		.offset(Math.max(0, o.page - 1) * o.limit);
	const [{ total }] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.where(and(...conds));
	return {
		items: rows.slice(0, o.limit).map(toItem),
		hasMore: rows.length > o.limit,
		total: Number(total)
	};
}

export type Variant = {
	id: string;
	role: 'original' | 'edit' | null;
	label: string | null;
	kind: string;
	ext: string;
	filename: string;
	relPath: string;
	size: number;
	width: number | null;
	height: number | null;
	contentHash: string | null;
	takenAt: string | null;
	takenAtSource: string | null;
	cameraMake: string | null;
	cameraModel: string | null;
	lens: string | null;
	focalLengthMm: number | null;
	fNumber: number | null;
	exposureTime: string | null;
	iso: number | null;
	gpsLat: number | null;
	gpsLon: number | null;
	colorProfile: string | null;
	rating: number | null;
	keywords: string[] | null;
	title: string | null;
	caption: string | null;
	metadata: Record<string, unknown> | null;
	thumbhash: string | null;
	urls: { thumb: string; preview: string; full: string };
	source: {
		name: string;
		slug: string;
		role: 'original' | 'edit';
		medium: 'film' | 'digital' | null;
		tier: 'A' | 'B' | null;
	};
};

export type PhotoDetail = {
	id: string;
	takenAt: string | null;
	tier: 'A' | 'B' | null;
	medium: 'film' | 'digital' | null;
	visibility: 'public' | 'hidden';
	title: string | null;
	caption: string | null;
	primaryFileId: string | null;
	originalFileId: string | null;
	variants: Variant[];
};

export async function getPhotoDetail(
	db: Db,
	id: string,
	admin: boolean
): Promise<PhotoDetail | null> {
	const [p] = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
	if (!p) return null;
	if (p.visibility !== 'public' && !admin) return null;
	const rows = await db
		.select({
			f: files,
			s: {
				name: sources.name,
				slug: sources.slug,
				role: sources.role,
				medium: sources.medium,
				tier: sources.tier
			}
		})
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(
			and(eq(files.photoId, id), eq(files.status, 'active'), eq(files.derivativesReady, true))
		);
	const variants: Variant[] = rows
		.map(({ f, s }) => {
			const v = versionOf(f.contentHash);
			return {
				id: f.id,
				role: f.variantRole,
				label: f.variantLabel,
				kind: f.kind,
				ext: f.ext,
				filename: f.filename,
				relPath: f.relPathNfc,
				size: f.size,
				width: f.width,
				height: f.height,
				contentHash: f.contentHash,
				takenAt: f.takenAt ? f.takenAt.toISOString() : null,
				takenAtSource: f.takenAtSource,
				cameraMake: f.cameraMake,
				cameraModel: f.cameraModel,
				lens: f.lens,
				focalLengthMm: f.focalLengthMm,
				fNumber: f.fNumber,
				exposureTime: f.exposureTime,
				iso: f.iso,
				gpsLat: f.gpsLat,
				gpsLon: f.gpsLon,
				colorProfile: f.colorProfile,
				rating: f.rating,
				keywords: f.keywords,
				title: f.title,
				caption: f.caption,
				metadata: f.metadata ?? null,
				thumbhash: b64(f.thumbhash),
				urls: {
					thumb: mediaUrl(f.id, 'thumb', v),
					preview: mediaUrl(f.id, 'preview', v),
					full: mediaUrl(f.id, 'full', v)
				},
				source: s
			};
		})
		.sort((a, b) => {
			// 보정 '기본' → 보정 기타 → RAW → JPG
			const rank = (x: Variant) =>
				x.role === 'edit' ? (x.label === '기본' ? 0 : 1) : x.kind === 'raw' ? 2 : 3;
			return rank(a) - rank(b) || a.filename.localeCompare(b.filename);
		});
	return {
		id: p.id,
		takenAt: p.takenAt ? p.takenAt.toISOString() : null,
		tier: p.tier,
		medium: p.medium,
		visibility: p.visibility,
		title: p.title,
		caption: p.caption,
		primaryFileId: p.primaryFileId,
		originalFileId: p.originalFileId,
		variants
	};
}

export async function neighbors(
	db: Db,
	photo: { id: string; takenAt: string | null },
	o: { scope: Scope; admin: boolean; includeB: boolean }
): Promise<{ prev: string | null; next: string | null }> {
	const conds = baseConds(o);
	const ta = photo.takenAt ?? new Date(0).toISOString();
	const key = sql`(coalesce(${photos.takenAt}, 'epoch'::timestamptz), ${photos.id})`;
	const cur = sql`(${ta}::timestamptz, ${photo.id})`;
	const [older] = await db
		.select({ id: photos.id })
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.where(and(...conds, sql`${key} < ${cur}`))
		.orderBy(desc(orderKey), desc(photos.id))
		.limit(1);
	const [newer] = await db
		.select({ id: photos.id })
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.where(and(...conds, sql`${key} > ${cur}`))
		.orderBy(asc(orderKey), asc(photos.id))
		.limit(1);
	return { prev: newer?.id ?? null, next: older?.id ?? null };
}

export async function setPhotoVisibility(
	db: Db,
	id: string,
	visibility: 'public' | 'hidden'
): Promise<void> {
	await db.update(photos).set({ visibility, updatedAt: new Date() }).where(eq(photos.id, id));
}

/** ctx 파라미터("archive" | "library:<slug>") → Scope. slug 가 없으면 archive. */
export async function scopeFromCtx(db: Db, ctx: string | null): Promise<Scope> {
	if (ctx?.startsWith('library:')) {
		const slug = ctx.slice('library:'.length);
		const [s] = await db
			.select({ id: sources.id })
			.from(sources)
			.where(eq(sources.slug, slug))
			.limit(1);
		if (s) return { kind: 'library', sourceId: s.id };
	}
	return { kind: 'archive' };
}
