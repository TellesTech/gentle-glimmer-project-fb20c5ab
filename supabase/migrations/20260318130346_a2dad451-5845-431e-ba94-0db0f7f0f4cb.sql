
CREATE TABLE public.portal_admin_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, site_id)
);

ALTER TABLE public.portal_admin_access ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything
CREATE POLICY "Super admins full access on portal_admin_access"
ON public.portal_admin_access
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Admins can read their own access
CREATE POLICY "Admins can read own portal access"
ON public.portal_admin_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
