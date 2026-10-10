// 갤러리 쿼리: 아카이브 / 라이브러리 목록, 사진 상세, 이웃(prev/next).
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { ArchiveFilter } from '#lib/archive.ts';
import { mediaUrl, versionOf } from '#lib/media.ts';
import type { Db } from './db';
import { files, photoMeta, photos, sources } from './db/schema';
import { folderMetaForSource, pickFolderMeta, toRollInfo, type RollInfo } from './folders';

export type Scope = { kind: 'archive' } | { kind: 'library'; sourceId: string };
export type ListOptions = {
	scope: Scope;
	admin: boolean;
	filter?: ArchiveFilter;
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

/** 공통 where: 처리된 파일 + (게스트면 공개만) + 스코프 + 아카이브 필터. 컷(A/B)은 라벨이라 여기서 거르지 않는다 — 필터가 고른다. */
export function baseConds(o: { scope: Scope; admin: boolean; filter?: ArchiveFilter }): SQL[] {
	const conds: SQL[] = [eq(files.derivativesReady, true), eq(files.status, 'active')];
	if (!o.admin) conds.push(eq(photos.visibility, 'public'));
	if (o.scope.kind === 'library') {
		conds.push(
			sql`exists (select 1 from ${files} f2 where f2.photo_id = ${photos.id} and f2.source_id = ${o.scope.sourceId})`
		);
	}
	conds.push(...filterConds(o.filter));
	return conds;
}

/** 아카이브 필터 → where 조건. camera/lens/film 은 photo_meta 뷰(유효 장비)를 left join 해 둬야 한다. */
export function filterConds(f: ArchiveFilter | undefined): SQL[] {
	const conds: SQL[] = [];
	if (!f) return conds;
	if (f.medium?.length) conds.push(inArray(photos.medium, f.medium));
	if (f.kind?.length) {
		const parts: SQL[] = [];
		if (f.kind.includes('A')) parts.push(eq(photos.tier, 'A'));
		if (f.kind.includes('B')) parts.push(eq(photos.tier, 'B'));
		if (f.kind.includes('original')) parts.push(isNull(photos.tier));
		conds.push(or(...parts)!);
	}
	if (f.camera) conds.push(eq(photoMeta.camera, f.camera));
	if (f.lens) conds.push(eq(photoMeta.lens, f.lens));
	if (f.film) conds.push(eq(photoMeta.filmStock, f.film));
	return conds;
}

export const orderKey = sql`coalesce(${photos.takenAt}, 'epoch'::timestamptz)`;

export const itemSelect = {
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
	camera: files.cameraModel
};

export function toItem(r: {
	id: string;
	/** 쿼리 빌더는 Date, 생 SQL(db.execute)은 문자열로 온다 */
	takenAt: Date | string | null;
	tier: 'A' | 'B' | null;
	medium: 'film' | 'digital' | null;
	visibility: 'public' | 'hidden';
	fileId: string;
	width: number | null;
	height: number | null;
	thumbhash: Uint8Array | null;
	contentHash: string | null;
	rotation: number;
	camera: string | null;
}): GalleryItem {
	const v = versionOf(r.contentHash, r.rotation);
	return {
		id: r.id,
		takenAt: r.takenAt ? new Date(r.takenAt).toISOString() : null,
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

/** 라이브러리 스코프: 그 Source 에 속한 variant 를 보여준다 (RAW 우선). 페어링 뒤에도 원본 폴더에서는 원본이 보인다. */
async function listLibraryPhotos(
	db: Db,
	o: ListOptions & { scope: { kind: 'library'; sourceId: string } }
) {
	const vis = o.admin ? sql`` : sql`and p.visibility = 'public'`;
	const rows = (await db.execute(sql`
		select * from (
			select distinct on (p.id) p.id, p.taken_at, p.tier, p.medium, p.visibility,
			       f.id as file_id, f.width, f.height, f.thumbhash, f.content_hash, f.rotation, f.camera_model
			from ${files} f join ${photos} p on p.id = f.photo_id
			where f.source_id = ${o.scope.sourceId} and f.status = 'active' and f.derivatives_ready ${vis}
			order by p.id, (f.kind = 'raw') desc, f.id
		) t
		order by coalesce(t.taken_at, 'epoch'::timestamptz) desc, t.id desc
		limit ${o.limit + 1} offset ${Math.max(0, o.page - 1) * o.limit}`)) as unknown as Record<
		string,
		unknown
	>[];
	const [{ total }] = (await db.execute(sql`
		select count(distinct p.id)::int as total
		from ${files} f join ${photos} p on p.id = f.photo_id
		where f.source_id = ${o.scope.sourceId} and f.status = 'active' and f.derivatives_ready ${vis}`)) as unknown as {
		total: number;
	}[];
	const items = rows.slice(0, o.limit).map((r) =>
		toItem({
			id: r.id as string,
			takenAt: (r.taken_at as Date | string | null) ?? null,
			tier: (r.tier as 'A' | 'B' | null) ?? null,
			medium: (r.medium as 'film' | 'digital' | null) ?? null,
			visibility: r.visibility as 'public' | 'hidden',
			fileId: r.file_id as string,
			width: (r.width as number | null) ?? null,
			height: (r.height as number | null) ?? null,
			thumbhash: (r.thumbhash as Uint8Array | null) ?? null,
			contentHash: (r.content_hash as string | null) ?? null,
			rotation: Number(r.rotation ?? 0),
			camera: (r.camera_model as string | null) ?? null
		})
	);
	return { items, hasMore: rows.length > o.limit, total: Number(total) };
}

export async function listPhotos(
	db: Db,
	o: ListOptions
): Promise<{ items: GalleryItem[]; hasMore: boolean; total: number }> {
	if (o.scope.kind === 'library')
		return listLibraryPhotos(
			db,
			o as ListOptions & { scope: { kind: 'library'; sourceId: string } }
		);
	const conds = baseConds(o);
	const rows = await db
		.select(itemSelect)
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.leftJoin(photoMeta, eq(photoMeta.photoId, photos.id))
		.where(and(...conds))
		.orderBy(desc(orderKey), desc(photos.id))
		.limit(o.limit + 1)
		.offset(Math.max(0, o.page - 1) * o.limit);
	const [{ total }] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.leftJoin(photoMeta, eq(photoMeta.photoId, photos.id))
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
	rotation: number;
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
	roll: RollInfo | null;
	urls: { thumb: string; preview: string; full: string };
	source: {
		name: string;
		slug: string;
		role: 'original' | 'edit';
		medium: 'film' | 'digital' | null;
		tier: 'A' | 'B' | null;
	};
};

export type MetaSource = 'manual' | 'exif' | 'roll' | null;
export type EffectiveMeta = {
	camera: string | null;
	lens: string | null;
	filmStock: string | null;
	from: { camera: MetaSource; lens: MetaSource; filmStock: MetaSource };
};
export type MetaOverride = {
	camera?: string | null;
	lens?: string | null;
	filmStock?: string | null;
} | null;

/** 사진의 유효 장비: 수동 > (필름이면 롤 > EXIF, 디지털이면 EXIF > 롤) */
export function effectiveMeta(
	medium: 'film' | 'digital' | null,
	override: MetaOverride,
	exif: { camera: string | null; lens: string | null },
	roll: RollInfo | null
): EffectiveMeta {
	const pick = (key: 'camera' | 'lens' | 'filmStock'): [string | null, MetaSource] => {
		const o = override?.[key];
		if (o) return [o, 'manual'];
		const r = roll ? roll[key] : null;
		const e = key === 'filmStock' ? null : exif[key];
		if (medium === 'film') return r ? [r, 'roll'] : e ? [e, 'exif'] : [null, null];
		return e ? [e, 'exif'] : r ? [r, 'roll'] : [null, null];
	};
	const [camera, fc] = pick('camera');
	const [lens, fl] = pick('lens');
	const [filmStock, ff] = pick('filmStock');
	return { camera, lens, filmStock, from: { camera: fc, lens: fl, filmStock: ff } };
}

export type PhotoDetail = {
	id: string;
	takenAt: string | null;
	tier: 'A' | 'B' | null;
	medium: 'film' | 'digital' | null;
	visibility: 'public' | 'hidden';
	visibilityManual: boolean;
	title: string | null;
	caption: string | null;
	primaryFileId: string | null;
	originalFileId: string | null;
	variants: Variant[];
	metaOverride: MetaOverride;
	effective: EffectiveMeta;
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
				id: sources.id,
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
	const metaBySource = new Map<string, Awaited<ReturnType<typeof folderMetaForSource>>>();
	for (const { s } of rows)
		if (!metaBySource.has(s.id)) metaBySource.set(s.id, await folderMetaForSource(db, s.id));
	const variants: Variant[] = rows
		.map(({ f, s }) => {
			const v = versionOf(f.contentHash, f.rotation);
			const fm = pickFolderMeta(metaBySource.get(s.id) ?? [], f.relPath);
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
				rotation: f.rotation,
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
				roll: fm ? toRollInfo(fm) : null,
				urls: {
					thumb: mediaUrl(f.id, 'thumb', v),
					preview: mediaUrl(f.id, 'preview', v),
					full: mediaUrl(f.id, 'full', v)
				},
				source: { name: s.name, slug: s.slug, role: s.role, medium: s.medium, tier: s.tier }
			};
		})
		.sort((a, b) => {
			// 보정 '기본' → 보정 기타 → RAW → JPG
			const rank = (x: Variant) =>
				x.role === 'edit' ? (x.label === '기본' ? 0 : 1) : x.kind === 'raw' ? 2 : 3;
			return rank(a) - rank(b) || a.filename.localeCompare(b.filename);
		});
	const base =
		variants.find((v) => v.id === p.originalFileId) ??
		variants.find((v) => v.id === p.primaryFileId) ??
		variants[0];
	const roll = base?.roll ?? variants.find((v) => v.roll)?.roll ?? null;
	const effective = effectiveMeta(
		p.medium,
		(p.metaOverride as MetaOverride) ?? null,
		{ camera: base?.cameraModel ?? null, lens: base?.lens ?? null },
		roll
	);
	return {
		id: p.id,
		takenAt: p.takenAt ? p.takenAt.toISOString() : null,
		tier: p.tier,
		medium: p.medium,
		visibility: p.visibility,
		visibilityManual: p.visibilityManual,
		title: p.title,
		caption: p.caption,
		primaryFileId: p.primaryFileId,
		originalFileId: p.originalFileId,
		variants,
		metaOverride: (p.metaOverride as MetaOverride) ?? null,
		effective
	};
}

export async function neighbors(
	db: Db,
	photo: { id: string; takenAt: string | null },
	o: { scope: Scope; admin: boolean; filter?: ArchiveFilter }
): Promise<{ prev: string | null; next: string | null }> {
	const conds = baseConds(o);
	const ta = photo.takenAt ?? new Date(0).toISOString();
	const key = sql`(coalesce(${photos.takenAt}, 'epoch'::timestamptz), ${photos.id})`;
	const cur = sql`(${ta}::timestamptz, ${photo.id})`;
	const [older] = await db
		.select({ id: photos.id })
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.leftJoin(photoMeta, eq(photoMeta.photoId, photos.id))
		.where(and(...conds, sql`${key} < ${cur}`))
		.orderBy(desc(orderKey), desc(photos.id))
		.limit(1);
	const [newer] = await db
		.select({ id: photos.id })
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.leftJoin(photoMeta, eq(photoMeta.photoId, photos.id))
		.where(and(...conds, sql`${key} > ${cur}`))
		.orderBy(asc(orderKey), asc(photos.id))
		.limit(1);
	return { prev: newer?.id ?? null, next: older?.id ?? null };
}

export async function setPhotoMetaOverride(db: Db, id: string, o: MetaOverride): Promise<void> {
	const clean =
		o && (o.camera || o.lens || o.filmStock)
			? { camera: o.camera || null, lens: o.lens || null, filmStock: o.filmStock || null }
			: null;
	await db
		.update(photos)
		.set({ metaOverride: clean, updatedAt: new Date() })
		.where(eq(photos.id, id));
}

export async function setPhotoVisibility(
	db: Db,
	id: string,
	visibility: 'public' | 'hidden'
): Promise<void> {
	await db
		.update(photos)
		.set({ visibility, visibilityManual: true, updatedAt: new Date() })
		.where(eq(photos.id, id));
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
