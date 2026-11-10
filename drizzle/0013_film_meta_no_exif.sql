-- 필름 사진은 EXIF 의 카메라·렌즈를 쓰지 않는다: 스캔 파일의 EXIF 는 스캔에 쓴 카메라·렌즈라 촬영 장비가 아니다.
-- (예전엔 롤 폴더에 렌즈를 비워 두면 스캔용 렌즈가 그 롤의 렌즈로 보였다.) 디지털은 그대로 EXIF > 롤.
DROP VIEW IF EXISTS "photo_meta";--> statement-breakpoint
CREATE VIEW "photo_meta" AS
SELECT b.photo_id,
  COALESCE(gc.name, b.camera) AS camera,
  COALESCE(gl.name, b.lens, gc.fixed_lens, gx.fixed_lens) AS lens,
  b.film_stock
FROM (
  SELECT p.id AS photo_id,
    COALESCE(NULLIF(p.meta_override->>'camera', ''),
      CASE WHEN p.medium = 'film' THEN r.camera ELSE COALESCE(f.camera_model, r.camera) END) AS camera,
    COALESCE(NULLIF(p.meta_override->>'lens', ''),
      CASE WHEN p.medium = 'film' THEN r.lens ELSE COALESCE(f.lens, r.lens) END) AS lens,
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
