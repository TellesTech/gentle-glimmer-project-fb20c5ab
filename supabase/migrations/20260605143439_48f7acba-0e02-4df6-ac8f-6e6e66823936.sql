CREATE OR REPLACE FUNCTION public._export_workforce_link_report()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
    SELECT ra.id AS record_id,
           ra.user_name AS nome_original,
           ra.user_id AS profile_id,
           p.name AS nome_cadastro,
           p.job_title AS funcao_cadastro,
           r.date::text AS data,
           pr.name AS projeto,
           s.name AS site,
           CASE WHEN ra.user_id IS NULL THEN 'sem_vinculo' ELSE 'vinculado' END AS status
    FROM public.report_attendance ra
    LEFT JOIN public.profiles p ON p.id = ra.user_id
    LEFT JOIN public.reports r ON r.id = ra.report_id
    LEFT JOIN public.projects pr ON pr.id = r.project_id
    LEFT JOIN public.sites s ON s.id = pr.site_id
    WHERE ra.present = true
    ORDER BY ra.user_id IS NULL DESC, ra.user_name, r.date
  ) t;
$$;
GRANT EXECUTE ON FUNCTION public._export_workforce_link_report() TO anon, authenticated;