CREATE TABLE public.portal_hidden_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  hidden_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, year, month)
);

GRANT SELECT, INSERT, DELETE ON public.portal_hidden_months TO authenticated;
GRANT ALL ON public.portal_hidden_months TO service_role;

ALTER TABLE public.portal_hidden_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read hidden months"
ON public.portal_hidden_months FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can hide months"
ON public.portal_hidden_months FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can unhide months"
ON public.portal_hidden_months FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));