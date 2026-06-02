-- 1) Add missing columns to reports
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS routine TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS blockage_status TEXT,
  ADD COLUMN IF NOT EXISTS blockage_revalidation_time TEXT,
  ADD COLUMN IF NOT EXISTS radio_frequency_wees TEXT,
  ADD COLUMN IF NOT EXISTS radio_frequency_operation TEXT,
  ADD COLUMN IF NOT EXISTS meeting_point TEXT,
  ADD COLUMN IF NOT EXISTS ambulance_point TEXT,
  ADD COLUMN IF NOT EXISTS arrival_time_at_liberator TEXT,
  ADD COLUMN IF NOT EXISTS document_release_time TEXT,
  ADD COLUMN IF NOT EXISTS use_weighted_progress BOOLEAN DEFAULT false;

-- 2) Create report_activity_steps
CREATE TABLE IF NOT EXISTS public.report_activity_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  weight NUMERIC NOT NULL DEFAULT 1,
  progress NUMERIC NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  quantity_done NUMERIC,
  total_quantity NUMERIC,
  unit TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_activity_steps TO authenticated;
GRANT ALL ON public.report_activity_steps TO service_role;

ALTER TABLE public.report_activity_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Report creators can manage activity steps" ON public.report_activity_steps;
CREATE POLICY "Report creators can manage activity steps"
ON public.report_activity_steps
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_activity_steps.report_id
      AND (
        r.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::user_role)
        OR public.has_role(auth.uid(), 'director'::user_role)
        OR public.has_role(auth.uid(), 'supervisor'::user_role)
        OR public.has_role(auth.uid(), 'leader'::user_role)
        OR public.has_role(auth.uid(), 'super_admin'::user_role)
      )
  )
);

DROP POLICY IF EXISTS "Users can view related activity steps" ON public.report_activity_steps;
CREATE POLICY "Users can view related activity steps"
ON public.report_activity_steps
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_activity_steps.report_id
      AND (
        r.created_by = auth.uid()
        OR r.team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
        OR r.project_id IN (
          SELECT p.id FROM public.projects p
          WHERE p.company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid())
        )
        OR public.has_role(auth.uid(), 'director'::user_role)
        OR public.has_role(auth.uid(), 'supervisor'::user_role)
        OR public.has_role(auth.uid(), 'super_admin'::user_role)
      )
  )
);

-- 3) Reforce grants for RDO tables (RLS already controls access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_activities TO authenticated;
GRANT ALL ON public.report_activities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_attendance TO authenticated;
GRANT ALL ON public.report_attendance TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_deviations TO authenticated;
GRANT ALL ON public.report_deviations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_photos TO authenticated;
GRANT ALL ON public.report_photos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_delays TO authenticated;
GRANT ALL ON public.workforce_delays TO service_role;
