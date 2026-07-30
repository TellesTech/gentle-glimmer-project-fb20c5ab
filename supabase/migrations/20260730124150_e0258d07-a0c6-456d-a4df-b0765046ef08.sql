
-- 1) Título vazio -> usa o local da atividade
UPDATE public.reports
SET maintenance_order_title = NULLIF(btrim(location), '')
WHERE (maintenance_order_title IS NULL OR btrim(maintenance_order_title) = '')
  AND NULLIF(btrim(location), '') IS NOT NULL;

-- 2) Herda o número da OM de outro RDO do mesmo projeto com o mesmo título normalizado
WITH norm AS (
  SELECT id, project_id, maintenance_order_number, created_at,
         btrim(regexp_replace(lower(unaccent(coalesce(maintenance_order_title,''))), '[^a-z0-9]+', ' ', 'g')) AS tkey
  FROM public.reports
),
src AS (
  SELECT DISTINCT ON (project_id, tkey) project_id, tkey, maintenance_order_number
  FROM norm
  WHERE maintenance_order_number IS NOT NULL AND tkey <> ''
  ORDER BY project_id, tkey, created_at
)
UPDATE public.reports r
SET maintenance_order_number = src.maintenance_order_number
FROM norm n
JOIN src ON src.project_id = n.project_id AND src.tkey = n.tkey
WHERE r.id = n.id
  AND r.maintenance_order_number IS NULL
  AND n.tkey <> '';

-- 3) Unifica o título por número de OM (usa o primeiro título registrado)
WITH canon AS (
  SELECT DISTINCT ON (maintenance_order_number) maintenance_order_number, maintenance_order_title
  FROM public.reports
  WHERE maintenance_order_number IS NOT NULL
    AND maintenance_order_title IS NOT NULL
    AND btrim(maintenance_order_title) <> ''
  ORDER BY maintenance_order_number, created_at
)
UPDATE public.reports r
SET maintenance_order_title = canon.maintenance_order_title
FROM canon
WHERE r.maintenance_order_number = canon.maintenance_order_number
  AND coalesce(r.maintenance_order_title,'') IS DISTINCT FROM canon.maintenance_order_title;
