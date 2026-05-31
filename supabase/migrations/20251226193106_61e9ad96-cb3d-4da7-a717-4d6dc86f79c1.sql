-- Drop problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Clients can view projects from assigned reports" ON public.projects;
DROP POLICY IF EXISTS "Clients can view sites from assigned reports" ON public.sites;
DROP POLICY IF EXISTS "Clients can view companies from assigned reports" ON public.companies;

-- Create SECURITY DEFINER function to get client project IDs (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_client_project_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r.project_id 
  FROM reports r
  INNER JOIN report_client_approvers rca ON rca.report_id = r.id
  INNER JOIN client_profiles cp ON cp.id = rca.client_id
  WHERE cp.user_id = _user_id
$$;

-- Recreate policies using the SECURITY DEFINER function (no circular JOINs)
CREATE POLICY "Clients can view projects from assigned reports"
ON public.projects FOR SELECT
USING (
  is_client(auth.uid()) AND 
  id IN (SELECT get_client_project_ids(auth.uid()))
);

CREATE POLICY "Clients can view sites from assigned reports"
ON public.sites FOR SELECT
USING (
  is_client(auth.uid()) AND 
  id IN (
    SELECT p.site_id FROM projects p 
    WHERE p.id IN (SELECT get_client_project_ids(auth.uid()))
  )
);

CREATE POLICY "Clients can view companies from assigned reports"
ON public.companies FOR SELECT
USING (
  is_client(auth.uid()) AND 
  id IN (
    SELECT p.company_id FROM projects p 
    WHERE p.id IN (SELECT get_client_project_ids(auth.uid()))
  )
);