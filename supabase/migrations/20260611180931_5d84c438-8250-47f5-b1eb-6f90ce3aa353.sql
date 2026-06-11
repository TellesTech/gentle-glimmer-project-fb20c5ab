
CREATE TABLE public.impact_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  manual_time_per_rdo integer NOT NULL DEFAULT 10,
  system_time_per_rdo integer NOT NULL DEFAULT 1,
  hourly_salary numeric NOT NULL DEFAULT 25,
  work_hours_per_day integer NOT NULL DEFAULT 8,
  work_days_per_month integer NOT NULL DEFAULT 22,
  document_search_time integer NOT NULL DEFAULT 60,
  hh_calculation_time integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.impact_settings TO authenticated;
GRANT ALL ON public.impact_settings TO service_role;

ALTER TABLE public.impact_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler impact_settings"
  ON public.impact_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins podem inserir impact_settings"
  ON public.impact_settings FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Admins podem atualizar impact_settings"
  ON public.impact_settings FOR UPDATE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Admins podem deletar impact_settings"
  ON public.impact_settings FOR DELETE
  TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER update_impact_settings_updated_at
  BEFORE UPDATE ON public.impact_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.impact_settings (company_id) VALUES (NULL);

-- Backfill: vincular user_id em report_attendance via função existente
SELECT public.link_workforce_to_profiles();
