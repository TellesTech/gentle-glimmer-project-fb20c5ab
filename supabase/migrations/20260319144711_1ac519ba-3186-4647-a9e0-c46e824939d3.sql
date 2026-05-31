CREATE TABLE public.service_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.service_report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates from their company"
  ON public.service_report_templates
  FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can create templates for their company"
  ON public.service_report_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Users can delete their own templates"
  ON public.service_report_templates
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::user_role)
    OR is_super_admin(auth.uid())
  );