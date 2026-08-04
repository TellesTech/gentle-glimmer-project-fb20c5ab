-- ============ Dependências de acesso ============
CREATE OR REPLACE FUNCTION public.get_user_project_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT t.project_id
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.user_has_site_access(_user_id uuid, _site_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _site_id IS NOT NULL
    AND (
      public.has_role(_user_id, 'super_admin'::user_role)
      OR EXISTS (
        SELECT 1 FROM public.sites s
        WHERE s.id = _site_id AND s.company_id = public.get_user_company_id(_user_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.portal_admin_access paa
        WHERE paa.user_id = _user_id AND paa.site_id = _site_id
      )
      OR EXISTS (
        SELECT 1 FROM public.site_responsibles sr
        WHERE sr.user_id = _user_id AND sr.site_id = _site_id
      )
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.site_id = _site_id AND p.id IN (SELECT public.get_user_project_ids(_user_id))
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.user_has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (
        public.has_role(_user_id, 'super_admin'::user_role)
        OR p.company_id = public.get_user_company_id(_user_id)
        OR _project_id IN (SELECT public.get_user_project_ids(_user_id))
        OR public.user_has_site_access(_user_id, p.site_id)
      )
  )
$$;

-- ============ Coluna do colaborador do portal na unidade ============
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS portal_collaborator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============ Resolução de slugs (links do convite) ============
CREATE OR REPLACE FUNCTION public.resolve_company_slug(p_slug text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id FROM public.companies c
  WHERE lower(trim(c.slug)) = lower(trim(p_slug))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_site_slug(p_company_id uuid, p_slug text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id FROM public.sites s
  WHERE s.company_id = p_company_id
    AND lower(trim(s.slug)) = lower(trim(p_slug))
  LIMIT 1;
$$;

-- ============ Dados públicos da tela de login ============
CREATE OR REPLACE FUNCTION public.get_company_public_info(p_company_id uuid)
RETURNS TABLE(id uuid, name text, logo_url text, photo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name, c.logo_url, c.photo_url
  FROM public.companies c
  WHERE c.id = p_company_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_company_portal_settings(p_company_id uuid)
RETURNS TABLE(
  id uuid,
  company_id uuid,
  welcome_title text,
  welcome_subtitle text,
  client_logo_url text,
  client_primary_color text,
  client_accent_color text,
  login_background_url text,
  login_welcome_text text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cps.id, cps.company_id, cps.welcome_title, cps.welcome_subtitle,
         cps.client_logo_url, cps.client_primary_color, cps.client_accent_color,
         NULL::text AS login_background_url, cps.login_welcome_text
  FROM public.client_portal_settings cps
  WHERE cps.company_id = p_company_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_company_login_contacts(p_company_id uuid, p_site_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, name text, email text, role text, avatar_url text, has_pin boolean, has_auth boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cc.id, trim(cc.name) AS name, cc.email, cc.role, cc.avatar_url,
         (cc.pin_hash IS NOT NULL AND cc.pin_hash <> '') AS has_pin,
         (cc.user_id IS NOT NULL) AS has_auth
  FROM public.company_contacts cc
  WHERE cc.company_id = p_company_id
    AND COALESCE(cc.is_active, true) = true
    AND (
      p_site_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.contact_sites cs
        WHERE cs.contact_id = cc.id AND cs.site_id = p_site_id
      )
    )
  ORDER BY 2;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_collaborator(p_profile_id uuid)
RETURNS TABLE(id uuid, name text, avatar_url text, job_title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.name, p.avatar_url, p.job_title
  FROM public.profiles p
  WHERE p.id = p_profile_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_company_login_stats(p_company_id uuid)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT json_build_object(
    'totalReports', (
      SELECT count(*) FROM public.reports r
      JOIN public.projects p ON p.id = r.project_id
      JOIN public.sites s ON s.id = p.site_id
      WHERE s.company_id = p_company_id
    ),
    'totalSignatures', (
      SELECT count(*) FROM public.report_signatures rs
      JOIN public.reports r ON r.id = rs.report_id
      JOIN public.projects p ON p.id = r.project_id
      JOIN public.sites s ON s.id = p.site_id
      WHERE s.company_id = p_company_id
    ),
    'activeProjects', (
      SELECT count(*) FROM public.projects p
      JOIN public.sites s ON s.id = p.site_id
      WHERE s.company_id = p_company_id
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_site_login_stats(p_site_id uuid)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT json_build_object(
    'totalReports', (
      SELECT count(*) FROM public.reports r
      JOIN public.projects p ON p.id = r.project_id
      WHERE p.site_id = p_site_id
    ),
    'totalSignatures', (
      SELECT count(*) FROM public.report_signatures rs
      JOIN public.reports r ON r.id = rs.report_id
      JOIN public.projects p ON p.id = r.project_id
      WHERE p.site_id = p_site_id
    ),
    'activeProjects', (
      SELECT count(*) FROM public.projects p
      WHERE p.site_id = p_site_id
    )
  );
$$;

-- ============ Portal autenticado ============
CREATE OR REPLACE FUNCTION public.resolve_client_portal_branding(p_company_id uuid DEFAULT NULL, p_site_id uuid DEFAULT NULL)
RETURNS TABLE(company_id uuid, site_id uuid, name text, logo_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_site_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_site_id IS NOT NULL AND public.user_has_site_access(v_user_id, p_site_id) THEN
    SELECT s.id, s.company_id INTO v_site_id, v_company_id
      FROM public.sites s WHERE s.id = p_site_id LIMIT 1;
  END IF;

  IF v_site_id IS NULL AND p_company_id IS NOT NULL THEN
    SELECT s.id, s.company_id INTO v_site_id, v_company_id
      FROM public.sites s
     WHERE s.company_id = p_company_id AND public.user_has_site_access(v_user_id, s.id)
     ORDER BY s.name LIMIT 1;
  END IF;

  IF v_site_id IS NULL THEN
    SELECT s.id, s.company_id INTO v_site_id, v_company_id
      FROM public.sites s
     WHERE public.user_has_site_access(v_user_id, s.id)
     ORDER BY s.name LIMIT 1;
  END IF;

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
       OR public.has_role(v_user_id, 'admin'::user_role)
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
  SELECT c.id, v_site_id, c.name, COALESCE(c.logo_url, c.photo_url)
  FROM public.companies c
  WHERE c.id = v_company_id
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_wees_responsibles(_company_id uuid)
RETURNS TABLE(id uuid, name text, job_title text, avatar_url text, has_signature boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR _company_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.has_role(v_user, 'super_admin'::user_role)
    OR public.has_role(v_user, 'admin'::user_role)
    OR public.get_user_company_id(v_user) = _company_id
    OR EXISTS (SELECT 1 FROM public.client_profiles cp WHERE cp.user_id = v_user AND cp.is_active = true AND cp.company_id = _company_id)
    OR EXISTS (SELECT 1 FROM public.company_contacts cc WHERE cc.user_id = v_user AND cc.is_active = true AND cc.company_id = _company_id)
    OR EXISTS (SELECT 1 FROM public.portal_admin_access paa JOIN public.sites s ON s.id = paa.site_id WHERE paa.user_id = v_user AND s.company_id = _company_id)
    OR EXISTS (SELECT 1 FROM public.site_responsibles sr JOIN public.sites s ON s.id = sr.site_id WHERE sr.user_id = v_user AND s.company_id = _company_id)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH wees_users AS (
    SELECT DISTINCT u.user_id
    FROM (
      SELECT paa.user_id, paa.site_id FROM public.portal_admin_access paa
      UNION
      SELECT sr.user_id, sr.site_id FROM public.site_responsibles sr
    ) u
    JOIN public.sites s ON s.id = u.site_id
    WHERE s.company_id = _company_id AND u.user_id IS NOT NULL
  )
  SELECT p.id, COALESCE(p.name, 'Sem nome'), p.job_title, p.avatar_url, (p.signature_data IS NOT NULL)
  FROM public.profiles p
  JOIN wees_users wu ON wu.user_id = p.id
  ORDER BY p.name;
END;
$$;

-- ============ Permissões de execução ============
GRANT EXECUTE ON FUNCTION public.resolve_company_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_site_slug(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_public_info(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_portal_settings(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_login_contacts(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_collaborator(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_login_stats(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_login_stats(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_client_portal_branding(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_wees_responsibles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_project_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_site_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_project_access(uuid, uuid) TO authenticated, service_role;