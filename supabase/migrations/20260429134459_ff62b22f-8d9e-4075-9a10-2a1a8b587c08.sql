-- Drop old policies on service_reports
DROP POLICY IF EXISTS "Users can view service reports from their company" ON public.service_reports;
DROP POLICY IF EXISTS "Users can insert service reports for their company" ON public.service_reports;
DROP POLICY IF EXISTS "Users can update service reports from their company" ON public.service_reports;
DROP POLICY IF EXISTS "Users can delete service reports from their company" ON public.service_reports;

-- Recreate with broader access: super_admin OR own company OR project access
CREATE POLICY "Users can view service reports they have access to"
ON public.service_reports
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR company_id = get_user_company_id(auth.uid())
  OR (project_id IS NOT NULL AND user_has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Users can insert service reports they have access to"
ON public.service_reports
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR company_id = get_user_company_id(auth.uid())
  OR (project_id IS NOT NULL AND user_has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Users can update service reports they have access to"
ON public.service_reports
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR company_id = get_user_company_id(auth.uid())
  OR (project_id IS NOT NULL AND user_has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Users can delete service reports they have access to"
ON public.service_reports
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR company_id = get_user_company_id(auth.uid())
  OR (project_id IS NOT NULL AND user_has_project_access(auth.uid(), project_id))
);