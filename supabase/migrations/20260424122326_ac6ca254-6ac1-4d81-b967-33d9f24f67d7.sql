-- 1) Adicionar PIS aos colaboradores
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pis text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_pis_unique ON public.profiles(pis) WHERE pis IS NOT NULL;

-- 2) Tabela de importações AFD
CREATE TABLE IF NOT EXISTS public.time_clock_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  employer_id text,
  employer_name text,
  nsr_inicial integer,
  nsr_final integer,
  period_start date,
  period_end date,
  total_records integer NOT NULL DEFAULT 0,
  unique_pis_count integer NOT NULL DEFAULT 0,
  unmapped_pis_count integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  raw_header text
);

CREATE INDEX IF NOT EXISTS idx_tci_company ON public.time_clock_imports(company_id);
CREATE INDEX IF NOT EXISTS idx_tci_site ON public.time_clock_imports(site_id);
CREATE INDEX IF NOT EXISTS idx_tci_period ON public.time_clock_imports(period_start, period_end);

ALTER TABLE public.time_clock_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_tci" ON public.time_clock_imports
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "admin_select_tci_company" ON public.time_clock_imports
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::user_role)
    AND company_id = public.get_user_company_id(auth.uid())
  );

CREATE POLICY "admin_insert_tci_company" ON public.time_clock_imports
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin'::user_role)
    AND company_id = public.get_user_company_id(auth.uid())
  );

CREATE POLICY "admin_delete_tci_company" ON public.time_clock_imports
  FOR DELETE USING (
    public.has_role(auth.uid(), 'admin'::user_role)
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- 3) Tabela de batidas
CREATE TABLE IF NOT EXISTS public.time_clock_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.time_clock_imports(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  nsr integer NOT NULL,
  punch_at timestamptz NOT NULL,
  punch_date date NOT NULL,
  punch_time time NOT NULL,
  pis text NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  raw_line text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tcr_import ON public.time_clock_records(import_id);
CREATE INDEX IF NOT EXISTS idx_tcr_company ON public.time_clock_records(company_id);
CREATE INDEX IF NOT EXISTS idx_tcr_pis_date ON public.time_clock_records(pis, punch_date);
CREATE INDEX IF NOT EXISTS idx_tcr_profile_date ON public.time_clock_records(profile_id, punch_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tcr_unique_nsr ON public.time_clock_records(import_id, nsr);

ALTER TABLE public.time_clock_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_tcr" ON public.time_clock_records
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "admin_select_tcr_company" ON public.time_clock_records
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::user_role)
    AND company_id = public.get_user_company_id(auth.uid())
  );

CREATE POLICY "admin_insert_tcr_company" ON public.time_clock_records
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin'::user_role)
    AND company_id = public.get_user_company_id(auth.uid())
  );

CREATE POLICY "admin_delete_tcr_company" ON public.time_clock_records
  FOR DELETE USING (
    public.has_role(auth.uid(), 'admin'::user_role)
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- 4) Função de auditoria AFD × RDO
CREATE OR REPLACE FUNCTION public.audit_afd_vs_rdo(
  p_site_id uuid,
  p_start date,
  p_end date,
  p_tolerance_minutes integer DEFAULT 15
)
RETURNS TABLE(
  audit_date date,
  profile_id uuid,
  profile_name text,
  pis text,
  job_function text,
  has_rdo boolean,
  rdo_arrival time,
  rdo_departure time,
  first_punch time,
  last_punch time,
  punch_count integer,
  arrival_diff_min integer,
  departure_diff_min integer,
  status text,
  severity text,
  report_id uuid
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Validate access
  SELECT s.company_id INTO v_company_id FROM public.sites s WHERE s.id = p_site_id;
  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.is_super_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::user_role) AND public.get_user_company_id(auth.uid()) = v_company_id)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  -- All RDO attendance rows in the period for the site
  rdo_att AS (
    SELECT
      r.date AS att_date,
      r.id AS r_id,
      ra.worker_name,
      ra.function_name,
      ra.arrival_time,
      ra.departure_time,
      -- Try to resolve to a profile by exact normalized name
      (
        SELECT p.id FROM public.profiles p
        WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(ra.worker_name))
        LIMIT 1
      ) AS p_id
    FROM public.reports r
    JOIN public.projects pr ON pr.id = r.project_id
    JOIN public.report_attendance ra ON ra.report_id = r.id
    WHERE pr.site_id = p_site_id
      AND r.date BETWEEN p_start AND p_end
  ),
  -- All AFD punches in the period for the company
  afd AS (
    SELECT
      tcr.punch_date AS att_date,
      tcr.pis,
      tcr.profile_id AS p_id,
      MIN(tcr.punch_time) AS first_p,
      MAX(tcr.punch_time) AS last_p,
      COUNT(*)::integer AS p_count
    FROM public.time_clock_records tcr
    WHERE tcr.company_id = v_company_id
      AND tcr.punch_date BETWEEN p_start AND p_end
    GROUP BY tcr.punch_date, tcr.pis, tcr.profile_id
  ),
  -- Aggregate RDO per (profile, date) — when profile resolved
  rdo_agg AS (
    SELECT
      att_date,
      p_id,
      MAX(worker_name) AS worker_name,
      MAX(function_name) AS function_name,
      MIN(arrival_time) AS arrival_time,
      MAX(departure_time) AS departure_time,
      MAX(r_id) AS r_id
    FROM rdo_att
    WHERE p_id IS NOT NULL
    GROUP BY att_date, p_id
  ),
  -- Full outer join between RDO (resolved) and AFD (resolved)
  joined AS (
    SELECT
      COALESCE(ra.att_date, af.att_date) AS j_date,
      COALESCE(ra.p_id, af.p_id) AS j_profile_id,
      af.pis AS j_pis,
      ra.worker_name AS j_name,
      ra.function_name AS j_func,
      ra.arrival_time AS j_arr,
      ra.departure_time AS j_dep,
      af.first_p AS j_first,
      af.last_p AS j_last,
      af.p_count AS j_count,
      ra.r_id AS j_report_id
    FROM rdo_agg ra
    FULL OUTER JOIN afd af
      ON af.att_date = ra.att_date AND af.p_id = ra.p_id AND af.p_id IS NOT NULL
    WHERE COALESCE(ra.p_id, af.p_id) IS NOT NULL
  ),
  -- Unmapped PIS rows (AFD punches with no profile)
  unmapped AS (
    SELECT
      af.att_date AS j_date,
      NULL::uuid AS j_profile_id,
      af.pis AS j_pis,
      NULL::text AS j_name,
      NULL::text AS j_func,
      NULL::time AS j_arr,
      NULL::time AS j_dep,
      af.first_p AS j_first,
      af.last_p AS j_last,
      af.p_count AS j_count,
      NULL::uuid AS j_report_id
    FROM afd af
    WHERE af.p_id IS NULL
  ),
  all_rows AS (
    SELECT * FROM joined
    UNION ALL
    SELECT * FROM unmapped
  )
  SELECT
    ar.j_date AS audit_date,
    ar.j_profile_id AS profile_id,
    COALESCE(ar.j_name, p.name) AS profile_name,
    COALESCE(ar.j_pis, p.pis) AS pis,
    ar.j_func AS job_function,
    (ar.j_arr IS NOT NULL OR ar.j_dep IS NOT NULL) AS has_rdo,
    ar.j_arr AS rdo_arrival,
    ar.j_dep AS rdo_departure,
    ar.j_first AS first_punch,
    ar.j_last AS last_punch,
    COALESCE(ar.j_count, 0) AS punch_count,
    CASE WHEN ar.j_arr IS NOT NULL AND ar.j_first IS NOT NULL
         THEN ABS(EXTRACT(EPOCH FROM (ar.j_first - ar.j_arr))/60)::integer
         ELSE NULL END AS arrival_diff_min,
    CASE WHEN ar.j_dep IS NOT NULL AND ar.j_last IS NOT NULL
         THEN ABS(EXTRACT(EPOCH FROM (ar.j_last - ar.j_dep))/60)::integer
         ELSE NULL END AS departure_diff_min,
    CASE
      WHEN ar.j_profile_id IS NULL THEN 'unmapped_pis'
      WHEN ar.j_arr IS NOT NULL AND ar.j_first IS NULL THEN 'no_punch'
      WHEN ar.j_arr IS NULL AND ar.j_first IS NOT NULL THEN 'no_rdo'
      WHEN ar.j_arr IS NOT NULL AND ar.j_first IS NOT NULL
           AND ABS(EXTRACT(EPOCH FROM (ar.j_first - ar.j_arr))/60) > p_tolerance_minutes
        THEN 'arrival_diff'
      WHEN ar.j_dep IS NOT NULL AND ar.j_last IS NOT NULL
           AND ABS(EXTRACT(EPOCH FROM (ar.j_last - ar.j_dep))/60) > p_tolerance_minutes
        THEN 'departure_diff'
      ELSE 'match'
    END AS status,
    CASE
      WHEN ar.j_profile_id IS NULL THEN 'high'
      WHEN ar.j_arr IS NOT NULL AND ar.j_first IS NULL THEN 'high'
      WHEN ar.j_arr IS NULL AND ar.j_first IS NOT NULL THEN 'high'
      WHEN ar.j_arr IS NOT NULL AND ar.j_first IS NOT NULL
           AND ABS(EXTRACT(EPOCH FROM (ar.j_first - ar.j_arr))/60) > 30
        THEN 'medium'
      WHEN ar.j_dep IS NOT NULL AND ar.j_last IS NOT NULL
           AND ABS(EXTRACT(EPOCH FROM (ar.j_last - ar.j_dep))/60) > 30
        THEN 'medium'
      WHEN ar.j_arr IS NOT NULL AND ar.j_first IS NOT NULL
           AND ABS(EXTRACT(EPOCH FROM (ar.j_first - ar.j_arr))/60) > p_tolerance_minutes
        THEN 'low'
      WHEN ar.j_dep IS NOT NULL AND ar.j_last IS NOT NULL
           AND ABS(EXTRACT(EPOCH FROM (ar.j_last - ar.j_dep))/60) > p_tolerance_minutes
        THEN 'low'
      ELSE 'low'
    END AS severity,
    ar.j_report_id AS report_id
  FROM all_rows ar
  LEFT JOIN public.profiles p ON p.id = ar.j_profile_id
  ORDER BY ar.j_date DESC, COALESCE(ar.j_name, p.name, ar.j_pis);
END;
$$;