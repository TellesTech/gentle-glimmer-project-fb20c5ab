
-- ═══════════════════════════════════════════════════════
-- FASE 1.1: Performance Indices (14 indices)
-- ═══════════════════════════════════════════════════════

-- Reports (tabela mais consultada, 367 rows, 0 índices custom)
CREATE INDEX IF NOT EXISTS idx_reports_project_id ON reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_team_id ON reports(team_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_project_date ON reports(project_id, date DESC);

-- Sub-tabelas de reports (1k-2k rows cada)
CREATE INDEX IF NOT EXISTS idx_report_activities_report_id ON report_activities(report_id);
CREATE INDEX IF NOT EXISTS idx_report_attendance_report_id ON report_attendance(report_id);
CREATE INDEX IF NOT EXISTS idx_report_deviations_report_id ON report_deviations(report_id);
CREATE INDEX IF NOT EXISTS idx_report_photos_report_id ON report_photos(report_id);

-- Profiles & Teams
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);

-- ═══════════════════════════════════════════════════════
-- FASE 1.2: Tabela de Auditoria de Correções
-- ═══════════════════════════════════════════════════════

CREATE TABLE public.data_corrections_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  column_name text NOT NULL,
  old_value text,
  new_value text,
  reason text NOT NULL,
  corrected_by uuid,
  reverted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.data_corrections_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manage" ON public.data_corrections_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::user_role));

-- Index for audit queries
CREATE INDEX idx_corrections_table ON data_corrections_log(table_name);
CREATE INDEX idx_corrections_created ON data_corrections_log(created_at DESC);

-- ═══════════════════════════════════════════════════════
-- FASE 2.1: Helper function for project access
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.user_has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = _project_id
    AND (
      p.company_id = get_user_company_id(_user_id)
      OR has_role(_user_id, 'super_admin'::user_role)
      OR _project_id IN (SELECT get_user_project_ids(_user_id))
    )
  )
$$;

-- ═══════════════════════════════════════════════════════
-- FASE 2.1: Fix RLS on project_weekly_progress
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can view progress" ON project_weekly_progress;
DROP POLICY IF EXISTS "Authenticated users can insert progress" ON project_weekly_progress;
DROP POLICY IF EXISTS "Authenticated users can update progress" ON project_weekly_progress;
DROP POLICY IF EXISTS "Authenticated users can delete progress" ON project_weekly_progress;

CREATE POLICY "Users can view project progress"
  ON project_weekly_progress FOR SELECT TO authenticated
  USING (public.user_has_project_access(auth.uid(), project_id));

CREATE POLICY "Managers can insert project progress"
  ON project_weekly_progress FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_project_access(auth.uid(), project_id)
    AND (
      has_role(auth.uid(), 'super_admin'::user_role)
      OR has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
      OR has_role(auth.uid(), 'supervisor'::user_role)
      OR has_role(auth.uid(), 'leader'::user_role)
    )
  );

CREATE POLICY "Managers can update project progress"
  ON project_weekly_progress FOR UPDATE TO authenticated
  USING (
    public.user_has_project_access(auth.uid(), project_id)
    AND (
      has_role(auth.uid(), 'super_admin'::user_role)
      OR has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
      OR has_role(auth.uid(), 'supervisor'::user_role)
      OR has_role(auth.uid(), 'leader'::user_role)
    )
  );

CREATE POLICY "Managers can delete project progress"
  ON project_weekly_progress FOR DELETE TO authenticated
  USING (
    public.user_has_project_access(auth.uid(), project_id)
    AND (
      has_role(auth.uid(), 'super_admin'::user_role)
      OR has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
      OR has_role(auth.uid(), 'supervisor'::user_role)
      OR has_role(auth.uid(), 'leader'::user_role)
    )
  );

-- ═══════════════════════════════════════════════════════
-- FASE 2.1: Fix RLS on project_daily_workforce
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can read project_daily_workforce" ON project_daily_workforce;
DROP POLICY IF EXISTS "Authenticated users can insert project_daily_workforce" ON project_daily_workforce;
DROP POLICY IF EXISTS "Authenticated users can update project_daily_workforce" ON project_daily_workforce;
DROP POLICY IF EXISTS "Authenticated users can delete project_daily_workforce" ON project_daily_workforce;

CREATE POLICY "Users can view daily workforce"
  ON project_daily_workforce FOR SELECT TO authenticated
  USING (public.user_has_project_access(auth.uid(), project_id));

CREATE POLICY "Managers can insert daily workforce"
  ON project_daily_workforce FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_project_access(auth.uid(), project_id)
    AND (
      has_role(auth.uid(), 'super_admin'::user_role)
      OR has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
      OR has_role(auth.uid(), 'supervisor'::user_role)
      OR has_role(auth.uid(), 'leader'::user_role)
    )
  );

CREATE POLICY "Managers can update daily workforce"
  ON project_daily_workforce FOR UPDATE TO authenticated
  USING (
    public.user_has_project_access(auth.uid(), project_id)
    AND (
      has_role(auth.uid(), 'super_admin'::user_role)
      OR has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
      OR has_role(auth.uid(), 'supervisor'::user_role)
      OR has_role(auth.uid(), 'leader'::user_role)
    )
  );

CREATE POLICY "Managers can delete daily workforce"
  ON project_daily_workforce FOR DELETE TO authenticated
  USING (
    public.user_has_project_access(auth.uid(), project_id)
    AND (
      has_role(auth.uid(), 'super_admin'::user_role)
      OR has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
      OR has_role(auth.uid(), 'supervisor'::user_role)
      OR has_role(auth.uid(), 'leader'::user_role)
    )
  );

-- ═══════════════════════════════════════════════════════
-- FASE 3.1: Normalization Triggers
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.normalize_profile_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name = INITCAP(TRIM(NEW.name));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_profile_name
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION normalize_profile_name();

CREATE OR REPLACE FUNCTION public.normalize_company_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name = TRIM(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_company_name
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION normalize_company_name();
