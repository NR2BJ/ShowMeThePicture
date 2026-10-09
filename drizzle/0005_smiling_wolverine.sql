CREATE TYPE "public"."gear_kind" AS ENUM('camera', 'lens', 'film');--> statement-breakpoint
CREATE TABLE "gear" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "gear_kind" NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"fixed_lens" text,
	"format" text,
	"notes" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "meta_override" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "gear_kind_name_uq" ON "gear" USING btree ("kind","name");