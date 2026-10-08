CREATE TABLE "pair_candidates" (
	"edit_file_id" text PRIMARY KEY NOT NULL,
	"original_file_id" text NOT NULL,
	"score" real NOT NULL,
	"method" "pair_method" NOT NULL,
	"rejected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pair_candidates" ADD CONSTRAINT "pair_candidates_edit_file_id_files_id_fk" FOREIGN KEY ("edit_file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_candidates" ADD CONSTRAINT "pair_candidates_original_file_id_files_id_fk" FOREIGN KEY ("original_file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pair_candidates_original_idx" ON "pair_candidates" USING btree ("original_file_id");