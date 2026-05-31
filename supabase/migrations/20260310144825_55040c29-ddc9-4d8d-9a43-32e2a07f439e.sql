
CREATE OR REPLACE FUNCTION public.resolve_site_slug(p_company_id uuid, p_slug text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.sites 
  WHERE company_id = p_company_id AND slug = lower(p_slug) 
  LIMIT 1;
$$;
