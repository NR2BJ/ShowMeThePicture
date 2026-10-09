// 파일 하나 처리: 해시 → ExifTool → (RAW 면 내장 프리뷰) → 파생본 → Photo 연결.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { ExifTool } from 'exiftool-vendored';
import type { Db } from '#lib/server/db/index.ts';
import { files, photos, sources } from '#lib/server/db/schema.ts';
import { folderMetaForSource, pickFolderMeta } from '#lib/server/folders.ts';
import { getSetting } from '#lib/server/settings.ts';
import { metadataJson, normalizeExif } from './exif.ts';
import { openSource } from '#lib/server/derive.ts';
import type { SizeName } from '#lib/media.ts';
import { deriveAll, removeDerivatives } from './image.ts';

export type ProcessCtx = {
	db: Db;
	exiftool: ExifTool;
	cacheDir: string;
	log: (msg: string) => void;
};

async function sha256(file: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const h = createHash('sha256');
		createReadStream(file)
			.on('data', (c) => h.update(c))
			.on('error', reject)
			.on('end', () => resolve(h.digest('hex')));
	});
}

/** 폴더명에서 날짜: 2025-03-12 / 20250312 */
function dateFromPath(rel: string): Date | null {
	const m = rel.match(/(?:^|\/)(\d{4})-?(\d{2})-?(\d{2})(?:[ _-]|\/|$)/);
	if (!m) return null;
	const d = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
	return isNaN(d.getTime()) ? null : d;
}

export async function processFile(ctx: ProcessCtx, fileId: string): Promise<void> {
	const { db } = ctx;
	const [row] = await db
		.select({ file: files, source: sources })
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(eq(files.id, fileId))
		.limit(1);
	if (!row) return;
	const { file, source } = row;
	const abs = path.join(source.rootPath, file.relPath);

	try {
		await access(abs);
	} catch {
		await db
			.update(files)
			.set({ status: 'missing', updatedAt: new Date() })
			.where(eq(files.id, fileId));
		return;
	}

	const contentHash = await sha256(abs);
	const tags = await ctx.exiftool.read(abs);
	const ex = normalizeExif(tags);
	const metadata = metadataJson(tags);

	// RAW 는 카메라 내장 프리뷰를 꺼내 쓴다 ("내가 현장에서 본 원본"). 미리 만드는 건 thumb/preview 뿐,
	// full 은 열 때 생성 (EAGER_FULL=1 이면 여기서도).
	const fullEdge = await getSetting<number>(db, 'guest_max_edge', 2560);
	const eager: SizeName[] =
		process.env.EAGER_FULL === '1' ? ['thumb', 'preview', 'full'] : ['thumb', 'preview'];
	const src = await openSource(ctx.exiftool, ctx.cacheDir, {
		id: fileId,
		kind: file.kind,
		absPath: abs,
		rotation: file.rotation
	});
	let d;
	try {
		d = await deriveAll(src.input, ctx.cacheDir, fileId, {
			eager,
			fullEdge,
			rotation: file.rotation
		});
	} finally {
		await src.cleanup();
	}

	// 촬영시각 결정. 디지털: EXIF/XMP → 폴더명 날짜 → 롤 → mtime.
	// 필름 스캔: 롤(현상월) → 폴더명 날짜 → EXIF(스캐너가 넣은 스캔일인 경우가 많아 뒤로) → mtime.
	const isFilm = source.medium === 'film';
	let takenAt: Date | null = null;
	let takenAtSource: 'exif' | 'xmp' | 'folder' | 'roll' | 'mtime' | null = null;
	const fromExif = () => {
		if (!takenAt && ex.takenAt) {
			takenAt = ex.takenAt;
			takenAtSource = ex.takenAtSource;
		}
	};
	const fromFolder = () => {
		if (takenAt) return;
		const d = dateFromPath(file.relPath);
		if (d) {
			takenAt = d;
			takenAtSource = 'folder';
		}
	};
	const fromRoll = async () => {
		if (takenAt) return;
		const meta = pickFolderMeta(await folderMetaForSource(db, source.id), file.relPath);
		if (!meta?.developedAt) return;
		const dir = path.posix.dirname(file.relPath);
		const siblings = await db
			.select({ relPath: files.relPath })
			.from(files)
			.where(eq(files.sourceId, source.id));
		const idx = siblings
			.map((x) => x.relPath)
			.filter((r) => path.posix.dirname(r) === dir)
			.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
			.indexOf(file.relPath);
		takenAt = new Date(
			new Date(meta.developedAt + 'T12:00:00').getTime() + Math.max(0, idx) * 60_000
		);
		takenAtSource = 'roll';
	};
	if (isFilm) {
		await fromRoll();
		fromFolder();
		fromExif();
	} else {
		fromExif();
		fromFolder();
		await fromRoll();
	}
	if (!takenAt) {
		takenAt = file.mtime;
		takenAtSource = 'mtime';
	}

	const width = d.width || ex.width;
	const height = d.height || ex.height;

	await db
		.update(files)
		.set({
			contentHash,
			width,
			height,
			orientation: ex.orientation,
			colorProfile: ex.colorProfile,
			takenAt,
			takenAtSource,
			cameraMake: ex.cameraMake,
			cameraModel: ex.cameraModel,
			lens: ex.lens,
			focalLengthMm: ex.focalLengthMm,
			fNumber: ex.fNumber,
			exposureTime: ex.exposureTime,
			iso: ex.iso,
			gpsLat: ex.gpsLat,
			gpsLon: ex.gpsLon,
			rating: ex.rating,
			keywords: ex.keywords,
			title: ex.title,
			caption: ex.caption,
			metadata,
			phash: d.phash,
			thumbhash: d.thumbhash,
			status: 'active',
			derivativesReady: true,
			processError: null,
			indexedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(files.id, fileId));

	await attachPhoto(ctx, fileId, source, { takenAt, isRaw: file.kind === 'raw' });
}

type SourceRow = typeof sources.$inferSelect;

/**
 * 1단계 규칙:
 *  - 원본 source: 같은 폴더·같은 stem_norm 의 파일(RAW+JPG)은 한 Photo. 표시는 RAW 우선.
 *  - 보정 source: 파일 하나가 Photo 하나 (원본과의 페어링은 2단계).
 */
export async function attachPhoto(
	ctx: { db: Db },
	fileId: string,
	source: SourceRow,
	info: { takenAt: Date | null; isRaw: boolean }
) {
	const { db } = ctx;
	const [me] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
	if (!me) return;
	if (me.photoId) {
		await refreshPhoto(db, me.photoId);
		return;
	}

	if (source.role === 'original') {
		const dir = path.posix.dirname(me.relPath);
		const siblings = await db
			.select({ id: files.id, relPath: files.relPath, photoId: files.photoId, kind: files.kind })
			.from(files)
			.where(
				and(eq(files.sourceId, source.id), eq(files.stemNorm, me.stemNorm), ne(files.id, fileId))
			);
		const sib = siblings.find((s) => path.posix.dirname(s.relPath) === dir && s.photoId);
		if (sib?.photoId) {
			await db
				.update(files)
				.set({
					photoId: sib.photoId,
					variantRole: 'original',
					variantLabel: me.kind === 'raw' ? 'RAW' : me.ext.toUpperCase()
				})
				.where(eq(files.id, fileId));
			await refreshPhoto(db, sib.photoId);
			return;
		}
	}

	const [photo] = await db
		.insert(photos)
		.values({
			primaryFileId: fileId,
			originalFileId: source.role === 'original' ? fileId : null,
			takenAt: info.takenAt,
			visibility: source.defaultVisibility,
			tier: source.role === 'edit' ? source.tier : null,
			medium: source.medium,
			pairMethod: null,
			pairConfirmed: false
		})
		.returning({ id: photos.id });
	await db
		.update(files)
		.set({
			photoId: photo.id,
			variantRole: source.role,
			variantLabel:
				source.role === 'edit'
					? (me.editLabel ?? '기본')
					: me.kind === 'raw'
						? 'RAW'
						: me.ext.toUpperCase()
		})
		.where(eq(files.id, fileId));
	await refreshPhoto(db, photo.id);
}

/** Photo 의 primary/original/taken_at 을 variants 로부터 다시 계산. RAW > JPG, 보정 '기본' > 최신. */
export async function refreshPhoto(db: Db, photoId: string): Promise<void> {
	const variants = await db
		.select({
			id: files.id,
			kind: files.kind,
			role: files.variantRole,
			label: files.variantLabel,
			takenAt: files.takenAt,
			mtime: files.mtime,
			status: files.status,
			ready: files.derivativesReady
		})
		.from(files)
		.where(eq(files.photoId, photoId));
	const live = variants.filter((v) => v.status === 'active' && v.ready);
	if (live.length === 0) {
		if (variants.length === 0) await db.delete(photos).where(eq(photos.id, photoId));
		return;
	}
	const originals = live.filter((v) => v.role === 'original');
	const edits = live.filter((v) => v.role === 'edit');
	const original = originals.find((v) => v.kind === 'raw') ?? originals[0] ?? null;
	const primaryEdit =
		edits.find((v) => v.label === '기본') ??
		edits.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0] ??
		null;
	const primary = primaryEdit ?? original ?? live[0];
	const takenAt = (original ?? primary).takenAt ?? primary.takenAt ?? null;
	await db
		.update(photos)
		.set({
			primaryFileId: primary.id,
			originalFileId: original?.id ?? null,
			takenAt,
			updatedAt: new Date()
		})
		.where(eq(photos.id, photoId));
}

export async function dropDerivatives(ctx: ProcessCtx, fileId: string): Promise<void> {
	await removeDerivatives(ctx.cacheDir, fileId);
	await ctx.db.update(files).set({ derivativesReady: false }).where(eq(files.id, fileId));
}

export { sql };
