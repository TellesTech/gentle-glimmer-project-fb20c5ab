-- Policy para clientes acessarem relatórios vinculados a eles
CREATE POLICY "Clients can view their assigned reports"
ON public.reports
FOR SELECT
USING (
  is_client(auth.uid()) AND
  id IN (
    SELECT report_id FROM public.report_client_approvers 
    WHERE client_id = get_client_profile_id(auth.uid())
  )
);

-- Policy para clientes acessarem atividades dos relatórios vinculados
CREATE POLICY "Clients can view assigned report activities"
ON public.report_activities
FOR SELECT
USING (
  is_client(auth.uid()) AND
  report_id IN (
    SELECT report_id FROM public.report_client_approvers 
    WHERE client_id = get_client_profile_id(auth.uid())
  )
);

-- Policy para clientes acessarem desvios dos relatórios vinculados
CREATE POLICY "Clients can view assigned report deviations"
ON public.report_deviations
FOR SELECT
USING (
  is_client(auth.uid()) AND
  report_id IN (
    SELECT report_id FROM public.report_client_approvers 
    WHERE client_id = get_client_profile_id(auth.uid())
  )
);

-- Policy para clientes acessarem fotos dos relatórios vinculados
CREATE POLICY "Clients can view assigned report photos"
ON public.report_photos
FOR SELECT
USING (
  is_client(auth.uid()) AND
  report_id IN (
    SELECT report_id FROM public.report_client_approvers 
    WHERE client_id = get_client_profile_id(auth.uid())
  )
);

-- Policy para clientes acessarem efetivo dos relatórios vinculados
CREATE POLICY "Clients can view assigned report attendance"
ON public.report_attendance
FOR SELECT
USING (
  is_client(auth.uid()) AND
  report_id IN (
    SELECT report_id FROM public.report_client_approvers 
    WHERE client_id = get_client_profile_id(auth.uid())
  )
);

-- Policy para clientes acessarem equipamentos dos relatórios vinculados
CREATE POLICY "Clients can view assigned report equipment"
ON public.report_equipment
FOR SELECT
USING (
  is_client(auth.uid()) AND
  report_id IN (
    SELECT report_id FROM public.report_client_approvers 
    WHERE client_id = get_client_profile_id(auth.uid())
  )
);

-- Policy para clientes acessarem assinaturas dos relatórios vinculados
CREATE POLICY "Clients can view assigned report signatures"
ON public.report_signatures
FOR SELECT
USING (
  is_client(auth.uid()) AND
  report_id IN (
    SELECT report_id FROM public.report_client_approvers 
    WHERE client_id = get_client_profile_id(auth.uid())
  )
);

-- Policy para clientes inserirem assinaturas nos relatórios vinculados
CREATE POLICY "Clients can insert signatures on assigned reports"
ON public.report_signatures
FOR INSERT
WITH CHECK (
  is_client(auth.uid()) AND
  report_id IN (
    SELECT report_id FROM public.report_client_approvers 
    WHERE client_id = get_client_profile_id(auth.uid())
  )
);

-- Policy para clientes acessarem projetos dos relatórios
CREATE POLICY "Clients can view projects from assigned reports"
ON public.projects
FOR SELECT
USING (
  is_client(auth.uid()) AND
  id IN (
    SELECT r.project_id FROM public.reports r
    JOIN public.report_client_approvers rca ON rca.report_id = r.id
    WHERE rca.client_id = get_client_profile_id(auth.uid())
  )
);

-- Policy para clientes acessarem sites dos projetos
CREATE POLICY "Clients can view sites from assigned reports"
ON public.sites
FOR SELECT
USING (
  is_client(auth.uid()) AND
  id IN (
    SELECT s.id FROM public.sites s
    JOIN public.projects p ON p.site_id = s.id
    JOIN public.reports r ON r.project_id = p.id
    JOIN public.report_client_approvers rca ON rca.report_id = r.id
    WHERE rca.client_id = get_client_profile_id(auth.uid())
  )
);

-- Policy para clientes acessarem empresas dos projetos
CREATE POLICY "Clients can view companies from assigned reports"
ON public.companies
FOR SELECT
USING (
  is_client(auth.uid()) AND
  id IN (
    SELECT c.id FROM public.companies c
    JOIN public.projects p ON p.company_id = c.id
    JOIN public.reports r ON r.project_id = p.id
    JOIN public.report_client_approvers rca ON rca.report_id = r.id
    WHERE rca.client_id = get_client_profile_id(auth.uid())
  )
);