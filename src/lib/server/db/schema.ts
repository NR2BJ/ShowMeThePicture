// docs/DESIGN.md §5 의 데이터 모델. 변경 후 `pnpm db:generate` 로 마이그레이션을 만든다.
import {
	pgTable,
	pgEnum,
	text,
	integer,
	bigint,
	boolean,
	timestamp,
	date,
	jsonb,
	real,
	doublePrecision,
	customType,
	index,
	uniqueIndex,
	primaryKey,
	vector,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { ulid } from 'ulid';

/** 임베딩 차원은 모델에 따른다. 모델을 바꾸면 ALTER + 재임베딩 (3단계). */
export const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM ?? 768);

// ---- enums ----
export const sourceRole = pgEnum('source_role', ['original', 'edit']);
export const medium = pgEnum('medium', ['film', 'digital']);
export const tier = pgEnum('tier', ['A', 'B']);
export const visibility = pgEnum('visibility', ['public', 'hidden']);
export const fileStatus = pgEnum('file_status', ['active', 'missing']);
export const fileKind = pgEnum('file_kind', [
	'raw',
	'jpeg',
	'tiff',
	'png',
	'webp',
	'heic',
	'other'
]);
export const variantRole = pgEnum('variant_role', ['original', 'edit']);
export const takenAtSource = pgEnum('taken_at_source', [
	'exif',
	'xmp',
	'folder',
	'roll',
	'mtime',
	'manual'
]);
export const collectionKind = pgEnum('collection_kind', ['manual', 'smart']);
export const collectionSort = pgEnum('collection_sort', ['taken_asc', 'taken_desc', 'manual']);
export const pairMethod = pgEnum('pair_method', ['stem', 'time', 'phash', 'manual']);

// ---- helpers ----
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
	dataType() {
		return 'bytea';
	}
});
const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => ulid());
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const timestamps = {
	createdAt: ts('created_at').notNull().defaultNow(),
	updatedAt: ts('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdateFn(() => new Date())
};

// ---- sources: 등록한 폴더 ----
export const sources = pgTable('sources', {
	id: id(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	/** 컨테이너 안 경로 (/photos/...) */
	rootPath: text('root_path').notNull().unique(),
	role: sourceRole('role').notNull(),
	medium: medium('medium'),
	tier: tier('tier'),
	defaultVisibility: visibility('default_visibility').notNull().default('hidden'),
	/** 게스트가 /library/{slug} 를 볼 수 있는지 */
	libraryPublic: boolean('library_public').notNull().default(false),
	pollIntervalMin: integer('poll_interval_min').notNull().default(30),
	lastScannedAt: ts('last_scanned_at'),
	...timestamps
});

// ---- photos: 논리적 사진 한 장 ----
export const photos = pgTable(
	'photos',
	{
		id: id(),
		/** 기본 표시 variant. 보정본 '기본' > RAW > JPG */
		primaryFileId: text('primary_file_id').references((): AnyPgColumn => files.id, {
			onDelete: 'set null'
		}),
		/** 토글 대상 원본. RAW 우선, 없으면 JPG */
		originalFileId: text('original_file_id').references((): AnyPgColumn => files.id, {
			onDelete: 'set null'
		}),
		takenAt: ts('taken_at'),
		title: text('title'),
		caption: text('caption'),
		visibility: visibility('visibility').notNull().default('hidden'),
		/** A=걸작, B=보정은 했지만 그 정도는 아님, null=보정본 없음 */
		tier: tier('tier'),
		medium: medium('medium'),
		pairMethod: pairMethod('pair_method'),
		pairConfidence: real('pair_confidence'),
		pairConfirmed: boolean('pair_confirmed').notNull().default(false),
		...timestamps
	},
	(t) => [
		index('photos_public_taken_idx').on(t.visibility, t.takenAt.desc()),
		index('photos_tier_idx').on(t.tier)
	]
);

// ---- files: 디스크의 파일 하나 ----
export const files = pgTable(
	'files',
	{
		id: id(),
		sourceId: text('source_id')
			.notNull()
			.references(() => sources.id, { onDelete: 'cascade' }),
		/** source.rootPath 기준 상대 경로. 원래 바이트 그대로 (접근용) */
		relPath: text('rel_path').notNull(),
		/** NFC 정규화 (표시·매칭용; macOS NFD 대응) */
		relPathNfc: text('rel_path_nfc').notNull(),
		filename: text('filename').notNull(),
		stem: text('stem').notNull(),
		/** 접미사(-Edit, _cyberpunk …) 제거한 stem. 페어링 키 */
		stemNorm: text('stem_norm').notNull(),
		/** 보정본 라벨 (접미사에서). 없으면 '기본' */
		editLabel: text('edit_label'),
		ext: text('ext').notNull(),
		kind: fileKind('kind').notNull(),
		size: bigint('size', { mode: 'number' }).notNull(),
		mtime: ts('mtime').notNull(),
		contentHash: text('content_hash'),
		status: fileStatus('status').notNull().default('active'),

		width: integer('width'),
		height: integer('height'),
		orientation: integer('orientation'),
		colorProfile: text('color_profile'),

		takenAt: ts('taken_at'),
		takenAtSource: takenAtSource('taken_at_source'),
		cameraMake: text('camera_make'),
		cameraModel: text('camera_model'),
		lens: text('lens'),
		focalLengthMm: real('focal_length_mm'),
		fNumber: real('f_number'),
		exposureTime: text('exposure_time'),
		iso: integer('iso'),
		gpsLat: doublePrecision('gps_lat'),
		gpsLon: doublePrecision('gps_lon'),
		rating: integer('rating'),
		keywords: text('keywords').array(),
		title: text('title'),
		caption: text('caption'),
		/** ExifTool 전체 덤프 */
		metadata: jsonb('metadata').$type<Record<string, unknown>>(),

		phash: bytea('phash'),
		thumbhash: bytea('thumbhash'),

		photoId: text('photo_id').references((): AnyPgColumn => photos.id, { onDelete: 'set null' }),
		variantRole: variantRole('variant_role'),
		/** RAW | JPG | 기본 | cyberpunk … */
		variantLabel: text('variant_label'),

		derivativesReady: boolean('derivatives_ready').notNull().default(false),
		indexedAt: ts('indexed_at'),
		...timestamps
	},
	(t) => [
		uniqueIndex('files_source_rel_path_uq').on(t.sourceId, t.relPath),
		index('files_content_hash_idx').on(t.contentHash),
		index('files_stem_norm_idx').on(t.stemNorm),
		index('files_taken_at_idx').on(t.takenAt),
		index('files_photo_idx').on(t.photoId),
		index('files_filename_trgm_idx').using('gin', t.filename.op('gin_trgm_ops')),
		index('files_caption_trgm_idx').using('gin', t.caption.op('gin_trgm_ops'))
	]
);

// ---- embeddings ----
export const embeddings = pgTable(
	'embeddings',
	{
		fileId: text('file_id')
			.primaryKey()
			.references(() => files.id, { onDelete: 'cascade' }),
		model: text('model').notNull(),
		embedding: vector('embedding', { dimensions: EMBEDDING_DIM }).notNull(),
		...timestamps
	},
	(t) => [index('embeddings_hnsw_idx').using('hnsw', t.embedding.op('vector_cosine_ops'))]
);

// ---- folder_meta: 롤/세션 메타, 하위 폴더에 상속 ----
export const folderMeta = pgTable(
	'folder_meta',
	{
		id: id(),
		sourceId: text('source_id')
			.notNull()
			.references(() => sources.id, { onDelete: 'cascade' }),
		relDir: text('rel_dir').notNull(),
		title: text('title'),
		developedAt: date('developed_at'),
		rollNo: integer('roll_no'),
		camera: text('camera'),
		lens: text('lens'),
		filmStock: text('film_stock'),
		filmFormat: text('film_format'),
		scanner: text('scanner'),
		notes: text('notes'),
		...timestamps
	},
	(t) => [uniqueIndex('folder_meta_source_dir_uq').on(t.sourceId, t.relDir)]
);

// ---- collections ----
export const collections = pgTable('collections', {
	id: id(),
	slug: text('slug').notNull().unique(),
	title: text('title').notNull(),
	statementMd: text('statement_md'),
	coverPhotoId: text('cover_photo_id').references(() => photos.id, { onDelete: 'set null' }),
	visibility: visibility('visibility').notNull().default('public'),
	kind: collectionKind('kind').notNull().default('manual'),
	rule: jsonb('rule').$type<Record<string, unknown>>(),
	sort: collectionSort('sort').notNull().default('taken_asc'),
	position: integer('position').notNull().default(0),
	...timestamps
});

export const series = pgTable(
	'series',
	{
		id: id(),
		collectionId: text('collection_id')
			.notNull()
			.references(() => collections.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		relDir: text('rel_dir'),
		position: integer('position').notNull().default(0)
	},
	(t) => [index('series_collection_idx').on(t.collectionId)]
);

export const collectionPhotos = pgTable(
	'collection_photos',
	{
		collectionId: text('collection_id')
			.notNull()
			.references(() => collections.id, { onDelete: 'cascade' }),
		photoId: text('photo_id')
			.notNull()
			.references(() => photos.id, { onDelete: 'cascade' }),
		seriesId: text('series_id').references(() => series.id, { onDelete: 'set null' }),
		position: integer('position').notNull().default(0)
	},
	(t) => [primaryKey({ columns: [t.collectionId, t.photoId] })]
);

// ---- admin & settings ----
export const adminUsers = pgTable('admin_users', {
	id: id(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	...timestamps
});

export const settings = pgTable('settings', {
	key: text('key').primaryKey(),
	value: jsonb('value').$type<unknown>().notNull(),
	updatedAt: ts('updated_at').notNull().defaultNow()
});
