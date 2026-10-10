DROP INDEX "embeddings_hnsw_idx";--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "embedding" SET DATA TYPE vector;--> statement-breakpoint
ALTER TABLE "embeddings" ADD COLUMN "dim" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "embeddings_model_idx" ON "embeddings" USING btree ("model");