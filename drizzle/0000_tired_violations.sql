CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."collection_kind" AS ENUM('manual', 'smart');--> statement-breakpoint
CREATE TYPE "public"."collection_sort" AS ENUM('taken_asc', 'taken_desc', 'manual');--> statement-breakpoint
CREATE TYPE "public"."file_kind" AS ENUM('raw', 'jpeg', 'tiff', 'png', 'webp', 'heic', 'other');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('active', 'missing');--> statement-breakpoint
CREATE TYPE "public"."medium" AS ENUM('film', 'digital');--> statement-breakpoint
CREATE TYPE "public"."pair_method" AS ENUM('stem', 'time', 'phash', 'manual');--> statement-breakpoint
CREATE TYPE "public"."source_role" AS ENUM('original', 'edit');--> statement-breakpoint
CREATE TYPE "public"."taken_at_source" AS ENUM('exif', 'xmp', 'folder', 'roll', 'mtime', 'manual');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."variant_role" AS ENUM('original', 'edit');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'hidden');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "collection_photos" (
	"collection_id" text NOT NULL,
	"photo_id" text NOT NULL,
	"series_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "collection_photos_collection_id_photo_id_pk" PRIMARY KEY("collection_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"statement_md" text,
	"cover_photo_id" text,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"kind" "collection_kind" DEFAULT 'manual' NOT NULL,
	"rule" jsonb,
	"sort" "collection_sort" DEFAULT 'taken_asc' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"file_id" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"rel_path" text NOT NULL,
	"rel_path_nfc" text NOT NULL,
	"filename" text NOT NULL,
	"stem" text NOT NULL,
	"stem_norm" text NOT NULL,
	"edit_label" text,
	"ext" text NOT NULL,
	"kind" "file_kind" NOT NULL,
	"size" bigint NOT NULL,
	"mtime" timestamp with time zone NOT NULL,
	"content_hash" text,
	"status" "file_status" DEFAULT 'active' NOT NULL,
	"width" integer,
	"height" integer,
	"orientation" integer,
	"color_profile" text,
	"taken_at" timestamp with time zone,
	"taken_at_source" "taken_at_source",
	"camera_make" text,
	"camera_model" text,
	"lens" text,
	"focal_length_mm" real,
	"f_number" real,
	"exposure_time" text,
	"iso" integer,
	"gps_lat" double precision,
	"gps_lon" double precision,
	"rating" integer,
	"keywords" text[],
	"title" text,
	"caption" text,
	"metadata" jsonb,
	"phash" "bytea",
	"thumbhash" "bytea",
	"photo_id" text,
	"variant_role" "variant_role",
	"variant_label" text,
	"derivatives_ready" boolean DEFAULT false NOT NULL,
	"indexed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folder_meta" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"rel_dir" text NOT NULL,
	"title" text,
	"developed_at" date,
	"roll_no" integer,
	"camera" text,
	"lens" text,
	"film_stock" text,
	"film_format" text,
	"scanner" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"primary_file_id" text,
	"original_file_id" text,
	"taken_at" timestamp with time zone,
	"title" text,
	"caption" text,
	"visibility" "visibility" DEFAULT 'hidden' NOT NULL,
	"tier" "tier",
	"medium" "medium",
	"pair_method" "pair_method",
	"pair_confidence" real,
	"pair_confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"title" text NOT NULL,
	"rel_dir" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"root_path" text NOT NULL,
	"role" "source_role" NOT NULL,
	"medium" "medium",
	"tier" "tier",
	"default_visibility" "visibility" DEFAULT 'hidden' NOT NULL,
	"library_public" boolean DEFAULT false NOT NULL,
	"poll_interval_min" integer DEFAULT 30 NOT NULL,
	"last_scanned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_slug_unique" UNIQUE("slug"),
	CONSTRAINT "sources_root_path_unique" UNIQUE("root_path")
);
--> statement-breakpoint
ALTER TABLE "collection_photos" ADD CONSTRAINT "collection_photos_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_photos" ADD CONSTRAINT "collection_photos_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_photos" ADD CONSTRAINT "collection_photos_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_cover_photo_id_photos_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_meta" ADD CONSTRAINT "folder_meta_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_primary_file_id_files_id_fk" FOREIGN KEY ("primary_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_original_file_id_files_id_fk" FOREIGN KEY ("original_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "embeddings_hnsw_idx" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "files_source_rel_path_uq" ON "files" USING btree ("source_id","rel_path");--> statement-breakpoint
CREATE INDEX "files_content_hash_idx" ON "files" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "files_stem_norm_idx" ON "files" USING btree ("stem_norm");--> statement-breakpoint
CREATE INDEX "files_taken_at_idx" ON "files" USING btree ("taken_at");--> statement-breakpoint
CREATE INDEX "files_photo_idx" ON "files" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "files_filename_trgm_idx" ON "files" USING gin ("filename" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "files_caption_trgm_idx" ON "files" USING gin ("caption" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "folder_meta_source_dir_uq" ON "folder_meta" USING btree ("source_id","rel_dir");--> statement-breakpoint
CREATE INDEX "photos_public_taken_idx" ON "photos" USING btree ("visibility","taken_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "photos_tier_idx" ON "photos" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "series_collection_idx" ON "series" USING btree ("collection_id");