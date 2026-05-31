
CREATE TYPE public.delay_type AS ENUM ('clima', 'material', 'equipamento', 'mao_de_obra', 'logistica', 'outro');

CREATE TABLE public.workforce_delays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  activity_name TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  delay_type public.delay_type NOT NULL DEFAULT 'outro',
  delay_hours NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workforce_delays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage workforce delays" ON public.workforce_delays
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR public.has_role(auth.uid(), 'super_admin'::user_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR public.has_role(auth.uid(), 'super_admin'::user_role)
  );
