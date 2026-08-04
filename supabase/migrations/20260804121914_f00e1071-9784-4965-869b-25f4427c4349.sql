CREATE OR REPLACE FUNCTION public.get_internal_signer_directory()
RETURNS TABLE(name_key text, display_name text, job_title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (lower(trim(p.name)))
         lower(trim(p.name)) AS name_key,
         p.name AS display_name,
         p.job_title
  FROM public.profiles p
  WHERE p.name IS NOT NULL AND trim(p.name) <> ''
  ORDER BY lower(trim(p.name)), p.updated_at DESC NULLS LAST
$$;

GRANT EXECUTE ON FUNCTION public.get_internal_signer_directory() TO anon, authenticated, service_role;