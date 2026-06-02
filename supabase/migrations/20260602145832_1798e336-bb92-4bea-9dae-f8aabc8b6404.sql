CREATE OR REPLACE FUNCTION public.get_login_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'totalReports',        (SELECT COUNT(*) FROM public.reports),
    'totalProjects',       (SELECT COUNT(*) FROM public.projects),
    'totalCompaniesSites', (SELECT COUNT(*) FROM public.sites)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_login_stats() TO anon, authenticated;