
CREATE OR REPLACE FUNCTION public.get_company_contact_report_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id FROM public.reports r
  JOIN public.projects p ON p.id = r.project_id
  WHERE (
    EXISTS (SELECT 1 FROM public.contact_sites cs JOIN public.company_contacts cc ON cc.id = cs.contact_id WHERE cc.user_id = _user_id AND cc.is_active = true)
    AND p.site_id IN (
      SELECT cs.site_id FROM public.contact_sites cs 
      JOIN public.company_contacts cc ON cc.id = cs.contact_id 
      WHERE cc.user_id = _user_id AND cc.is_active = true
    )
  ) OR (
    NOT EXISTS (SELECT 1 FROM public.contact_sites cs JOIN public.company_contacts cc ON cc.id = cs.contact_id WHERE cc.user_id = _user_id AND cc.is_active = true)
    AND EXISTS (
      SELECT 1 FROM public.sites s 
      JOIN public.company_contacts cc ON cc.company_id = s.company_id 
      WHERE s.id = p.site_id AND cc.user_id = _user_id AND cc.is_active = true
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.get_company_contact_project_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id FROM public.projects p
  WHERE (
    EXISTS (SELECT 1 FROM public.contact_sites cs JOIN public.company_contacts cc ON cc.id = cs.contact_id WHERE cc.user_id = _user_id AND cc.is_active = true)
    AND p.site_id IN (
      SELECT cs.site_id FROM public.contact_sites cs 
      JOIN public.company_contacts cc ON cc.id = cs.contact_id 
      WHERE cc.user_id = _user_id AND cc.is_active = true
    )
  ) OR (
    NOT EXISTS (SELECT 1 FROM public.contact_sites cs JOIN public.company_contacts cc ON cc.id = cs.contact_id WHERE cc.user_id = _user_id AND cc.is_active = true)
    AND EXISTS (
      SELECT 1 FROM public.sites s 
      JOIN public.company_contacts cc ON cc.company_id = s.company_id 
      WHERE s.id = p.site_id AND cc.user_id = _user_id AND cc.is_active = true
    )
  )
$$;
