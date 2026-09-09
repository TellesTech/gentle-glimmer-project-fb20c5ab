CREATE TABLE public.portal_hidden_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL UNIQUE,
  company_id uuid,
  site_id uuid,
  mode text NOT NULL DEFAULT 'hidden',
  hidden_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_hidden_reports TO authenticated;
GRANT ALL ON public.portal_hidden_reports TO service_role;

ALTER TABLE public.portal_hidden_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read hidden reports"
ON public.portal_hidden_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "WEES admins can insert hidden reports"
ON public.portal_hidden_reports FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "WEES admins can update hidden reports"
ON public.portal_hidden_reports FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "WEES admins can delete hidden reports"
ON public.portal_hidden_reports FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_portal_hidden_reports_updated_at
BEFORE UPDATE ON public.portal_hidden_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.portal_hidden_months
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'hidden';

DROP POLICY IF EXISTS "Super admins can insert hidden months" ON public.portal_hidden_months;
DROP POLICY IF EXISTS "Super admins can delete hidden months" ON public.portal_hidden_months;

CREATE POLICY "WEES admins can insert hidden months"
ON public.portal_hidden_months FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "WEES admins can delete hidden months"
ON public.portal_hidden_months FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "WEES admins can update hidden months"
ON public.portal_hidden_months FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'));