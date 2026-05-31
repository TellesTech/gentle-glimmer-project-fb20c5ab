
CREATE TABLE public.workforce_database (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES public.report_attendance(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  date DATE NOT NULL,
  worker_name TEXT NOT NULL,
  function_role TEXT,
  start_time TEXT,
  end_time TEXT,
  normal_hours NUMERIC(5,2) DEFAULT 0,
  compensation_hours NUMERIC(5,2) DEFAULT 0,
  overtime_75 NUMERIC(5,2) DEFAULT 0,
  overtime_100 NUMERIC(5,2) DEFAULT 0,
  night_bonus NUMERIC(5,2) DEFAULT 0,
  processed_by_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workforce_database ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workforce data from their company"
  ON public.workforce_database FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::user_role)
  );

CREATE POLICY "Users can insert workforce data for their company"
  ON public.workforce_database FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::user_role)
  );

CREATE POLICY "Users can delete workforce data from their company"
  ON public.workforce_database FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::user_role)
  );
