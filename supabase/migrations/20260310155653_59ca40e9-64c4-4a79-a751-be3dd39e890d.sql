CREATE OR REPLACE FUNCTION public.get_login_stats()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT json_build_object(
    'totalReports', (SELECT count(*) FROM public.reports),
    'totalProjects', (SELECT count(*) FROM public.projects),
    'totalCompaniesSites', (SELECT count(*) FROM public.sites)
  );
$$;