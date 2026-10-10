ALTER TABLE "sources" DROP COLUMN "library_public";--> statement-breakpoint
CREATE VIEW "photo_meta" AS
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
) r ON TRUE;
