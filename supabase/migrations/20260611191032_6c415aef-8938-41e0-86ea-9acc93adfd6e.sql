WITH numbered AS (
  SELECT id, project_id,
         ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) AS seq
  FROM public.reports
  WHERE rdo_number IS NULL
),
maxes AS (
  SELECT project_id, COALESCE(MAX(rdo_number), 0) AS max_num
  FROM public.reports
  GROUP BY project_id
)
UPDATE public.reports r
SET rdo_number = m.max_num + n.seq
FROM numbered n
JOIN maxes m ON m.project_id = n.project_id
WHERE r.id = n.id;