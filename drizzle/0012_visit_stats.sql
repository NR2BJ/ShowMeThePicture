CREATE TABLE "photo_view_days" (
	"photo_id" text NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "photo_view_days_photo_id_day_pk" PRIMARY KEY("photo_id","day")
);
--> statement-breakpoint
CREATE TABLE "visit_days" (
	"day" date PRIMARY KEY NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_seen" (
	"day" date NOT NULL,
	"target" text NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "visit_seen_day_target_hash_pk" PRIMARY KEY("day","target","hash")
);
--> statement-breakpoint
ALTER TABLE "photo_view_days" ADD CONSTRAINT "photo_view_days_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_view_days_day_idx" ON "photo_view_days" USING btree ("day");