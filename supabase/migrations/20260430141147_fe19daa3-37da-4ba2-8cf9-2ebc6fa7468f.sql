CREATE OR REPLACE FUNCTION public.get_portal_wees_responsibles(_company_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  job_title text,
  avatar_url text,
  has_signature boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_authorized boolean := false;
BEGIN
  IF v_user IS NULL OR _company_id IS NULL THEN
    RETURN;
  END IF;

  -- Authorization: WEES staff (super_admin/admin) OR client/contact/portal user tied to the company
  IF public.has_role(v_user, 'super_admin'::user_role)
     OR public.has_role(v_user, 'admin'::user_role)
     OR public.get_user_company_id(v_user) = _company_id
     OR EXISTS (
       SELECT 1 FROM public.client_profiles cp
       WHERE cp.user_id = v_user AND cp.is_active = true AND cp.company_id = _company_id
     )
     OR EXISTS (
       SELECT 1 FROM public.company_contacts cc
       WHERE cc.user_id = v_user AND cc.is_active = true AND cc.company_id = _company_id
     )
     OR EXISTS (
       SELECT 1
       FROM public.portal_admin_access paa
       JOIN public.sites s ON s.id = paa.site_id
       WHERE paa.user_id = v_user AND s.company_id = _company_id
     )
     OR EXISTS (
       SELECT 1
       FROM public.site_responsibles sr
       JOIN public.sites s ON s.id = sr.site_id
       WHERE sr.user_id = v_user AND s.company_id = _company_id
     )
  THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH wees_users AS (
    SELECT DISTINCT u.user_id
    FROM (
      SELECT paa.user_id, paa.site_id
        FROM public.portal_admin_access paa
      UNION
      SELECT sr.user_id, sr.site_id
        FROM public.site_responsibles sr
    ) u
    JOIN public.sites s ON s.id = u.site_id
    WHERE s.company_id = _company_id
      AND u.user_id IS NOT NULL
  )
  SELECT
    p.id,
    COALESCE(p.name, 'Sem nome') AS name,
    p.job_title,
    p.avatar_url,
    (p.signature_data IS NOT NULL) AS has_signature
  FROM public.profiles p
  JOIN wees_users wu ON wu.user_id = p.id
  ORDER BY p.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_wees_responsibles(uuid) TO authenticated;