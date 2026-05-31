CREATE TABLE public.contact_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.company_contacts(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(contact_id, site_id)
);

ALTER TABLE public.contact_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contact_sites" ON public.contact_sites
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::user_role) OR has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'director'::user_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::user_role) OR has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'director'::user_role));

CREATE POLICY "Contacts can view own site assignments" ON public.contact_sites
FOR SELECT TO authenticated
USING (contact_id IN (SELECT id FROM public.company_contacts WHERE user_id = auth.uid()));