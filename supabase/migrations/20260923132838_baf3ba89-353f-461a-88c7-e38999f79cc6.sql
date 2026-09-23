WITH nophotos AS (
  SELECT r.id, r.created_by, r.created_at FROM reports r
  WHERE NOT EXISTS (SELECT 1 FROM report_photos p WHERE p.report_id = r.id)
), orph AS (
  SELECT o.name, o.created_at, o.owner FROM storage.objects o
  WHERE o.bucket_id = 'service-report-photos'
    AND o.created_at > now() - interval '90 days'
    AND o.owner IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM report_photos p WHERE p.url LIKE '%' || o.name)
), m AS (
  SELECT orph.name, n.id AS report_id,
    row_number() OVER (PARTITION BY orph.name ORDER BY abs(extract(epoch FROM (n.created_at - orph.created_at)))) AS rn
  FROM orph JOIN nophotos n ON n.created_by = orph.owner
  WHERE abs(extract(epoch FROM (n.created_at - orph.created_at))) < 1800
)
INSERT INTO public.report_photos (report_id, url)
SELECT report_id,
  'https://jujzmxbexukxljljpefu.supabase.co/storage/v1/object/public/service-report-photos/' || name
FROM m WHERE rn = 1;