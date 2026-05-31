CREATE OR REPLACE FUNCTION public.resolve_client_portal_branding(
  p_company_id uuid DEFAULT NULL,
  p_site_id uuid DEFAULT NULL
)
RETURNS TABLE(
  company_id uuid,
  site_id uuid,
  name text,
  logo_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_site_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- 1) Prefer an explicit site when the user has access to it.
  IF p_site_id IS NOT NULL AND public.user_has_site_access(v_user_id, p_site_id) THEN
    SELECT s.id, s.company_id
      INTO v_site_id, v_company_id
      FROM public.sites s
     WHERE s.id = p_site_id
     LIMIT 1;
  END IF;

  -- 2) If only company was provided, pick one accessible site for that company.
  IF v_site_id IS NULL AND p_company_id IS NOT NULL THEN
    SELECT s.id, s.company_id
      INTO v_site_id, v_company_id
      FROM public.sites s
     WHERE s.company_id = p_company_id
       AND public.user_has_site_access(v_user_id, s.id)
     ORDER BY s.name
     LIMIT 1;
  END IF;

  -- 3) If no URL context exists, resolve by portal-admin or responsible site access.
  IF v_site_id IS NULL THEN
    SELECT s.id, s.company_id
      INTO v_site_id, v_company_id
      FROM public.sites s
     WHERE public.user_has_site_access(v_user_id, s.id)
     ORDER BY s.name
     LIMIT 1;
  END IF;

  -- 4) Client/contact fallback by company when there is no specific site.
  IF v_company_id IS NULL THEN
    SELECT COALESCE(cp.company_id, cc.company_id, public.get_user_company_id(v_user_id))
      INTO v_company_id
      FROM (SELECT 1) seed
      LEFT JOIN public.client_profiles cp ON cp.user_id = v_user_id AND cp.is_active = true
      LEFT JOIN public.company_contacts cc ON cc.user_id = v_user_id AND cc.is_active = true
     LIMIT 1;
  END IF;

  IF v_company_id IS NULL AND p_company_id IS NOT NULL THEN
    IF public.has_role(v_user_id, 'super_admin'::user_role)
       OR p_company_id = public.get_user_company_id(v_user_id)
       OR EXISTS (SELECT 1 FROM public.company_contacts cc WHERE cc.user_id = v_user_id AND cc.is_active = true AND cc.company_id = p_company_id)
       OR EXISTS (SELECT 1 FROM public.client_profiles cp WHERE cp.user_id = v_user_id AND cp.is_active = true AND cp.company_id = p_company_id)
    THEN
      v_company_id := p_company_id;
    END IF;
  END IF;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS company_id,
    v_site_id AS site_id,
    COALESCE(s.name, c.name) AS name,
    COALESCE(s.photo_url, cps.client_logo_url, c.logo_url, c.photo_url) AS logo_url
  FROM public.companies c
  LEFT JOIN public.sites s ON s.id = v_site_id
  LEFT JOIN public.client_portal_settings cps ON cps.company_id = c.id
  WHERE c.id = v_company_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_client_portal_branding(uuid, uuid) TO authenticated;