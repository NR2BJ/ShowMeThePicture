CREATE TABLE "gear_names" (
	"kind" "gear_kind" NOT NULL,
	"raw" text NOT NULL,
	"gear_id" text NOT NULL,
	CONSTRAINT "gear_names_kind_raw_pk" PRIMARY KEY("kind","raw")
);
--> statement-breakpoint
ALTER TABLE "gear_names" ADD CONSTRAINT "gear_names_gear_id_gear_id_fk" FOREIGN KEY ("gear_id") REFERENCES "public"."gear"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 유효 장비 뷰: 예전 계산(수동 > 롤/EXIF) 위에 등록 장비 이름 대응(gear_names)과 고정렌즈를 얹는다.
DROP VIEW IF EXISTS "photo_meta";--> statement-breakpoint
CREATE VIEW "photo_meta" AS
SELECT b.photo_id,
  COALESCE(gc.name, b.camera) AS camera,
  COALESCE(gl.name, b.lens, gc.fixed_lens, gx.fixed_lens) AS lens,
  b.film_stock
FROM (
  SELECT p.id AS photo_id,
    COALESCE(NULLIF(p.meta_override->>'camera', ''),
      CASE WHEN p.medium = 'film' THEN r.camera ELSE f.camera_model END,
      CASE WHEN p.medium = 'film' THEN f.camera_model ELSE r.camera END) AS camera,
    COALESCE(NULLIF(p.meta_override->>'lens', ''),
      CASE WHEN p.medium = 'film' THEN r.lens ELSE f.lens END,
      CASE WHEN p.medium = 'film' THEN f.lens ELSE r.lens END) AS lens,
    COALESCE(NULLIF(p.meta_override->>'filmStock', ''), r.film_stock) AS film_stock
  FROM "photos" p
  LEFT JOIN "files" f ON f.id = COALESCE(p.original_file_id, p.primary_file_id)
  LEFT JOIN LATERAL (
    SELECT fm.camera, fm.lens, fm.film_stock
    FROM "folder_meta" fm
    WHERE fm.source_id = f.source_id
      AND (fm.rel_dir IN ('', '.')
        OR fm.rel_dir = (CASE WHEN position('/' IN f.rel_path) > 0 THEN regexp_replace(f.rel_path, '/[^/]*$', '') ELSE '.' END)
        OR left((CASE WHEN position('/' IN f.rel_path) > 0 THEN regexp_replace(f.rel_path, '/[^/]*$', '') ELSE '.' END), length(fm.rel_dir) + 1) = fm.rel_dir || '/')
    ORDER BY length(fm.rel_dir) DESC
    LIMIT 1
  ) r ON TRUE
) b
LEFT JOIN "gear_names" nc ON nc.kind = 'camera' AND nc.raw = b.camera
LEFT JOIN "gear" gc ON gc.id = nc.gear_id
LEFT JOIN "gear" gx ON gc.id IS NULL AND gx.kind = 'camera' AND gx.name = b.camera
LEFT JOIN "gear_names" nl ON nl.kind = 'lens' AND nl.raw = b.lens
LEFT JOIN "gear" gl ON gl.id = nl.gear_id;
