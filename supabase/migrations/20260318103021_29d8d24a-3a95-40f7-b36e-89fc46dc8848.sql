
CREATE TABLE public.impact_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  manual_time_per_rdo INTEGER NOT NULL DEFAULT 45,
  system_time_per_rdo INTEGER NOT NULL DEFAULT 8,
  hourly_salary NUMERIC(10,2) NOT NULL DEFAULT 35.00,
  work_hours_per_day INTEGER NOT NULL DEFAULT 8,
  work_days_per_month INTEGER NOT NULL DEFAULT 22,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.impact_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read impact_settings"
  ON public.impact_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage impact_settings"
  ON public.impact_settings FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR public.has_role(auth.uid(), 'super_admin'::user_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR public.has_role(auth.uid(), 'super_admin'::user_role)
  );

-- Insert default global settings
INSERT INTO public.impact_settings (company_id) VALUES (NULL);

-- Trigger for updated_at
CREATE TRIGGER update_impact_settings_updated_at
  BEFORE UPDATE ON public.impact_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
