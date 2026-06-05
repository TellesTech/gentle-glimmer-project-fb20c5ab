
-- 1. client_portal_settings: restrict SELECT to same-company users, assigned clients, and super_admin
DROP POLICY IF EXISTS "Authenticated can read portal settings" ON public.client_portal_settings;
CREATE POLICY "Users read portal settings of their company"
ON public.client_portal_settings
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR company_id = get_user_company_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.client_companies cc
    JOIN public.client_profiles cp ON cp.id = cc.client_id
    WHERE cc.company_id = client_portal_settings.company_id
      AND cp.user_id = auth.uid()
  )
);

-- 2. project_equipment: scope manage policy to user's company
DROP POLICY IF EXISTS "Managers can manage equipment" ON public.project_equipment;
CREATE POLICY "Managers can manage equipment in their company"
ON public.project_equipment
FOR ALL
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    (has_role(auth.uid(), 'admin'::user_role)
     OR has_role(auth.uid(), 'director'::user_role)
     OR has_role(auth.uid(), 'supervisor'::user_role)
     OR has_role(auth.uid(), 'leader'::user_role))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_equipment.project_id
        AND p.company_id = get_user_company_id(auth.uid())
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    (has_role(auth.uid(), 'admin'::user_role)
     OR has_role(auth.uid(), 'director'::user_role)
     OR has_role(auth.uid(), 'supervisor'::user_role)
     OR has_role(auth.uid(), 'leader'::user_role))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_equipment.project_id
        AND p.company_id = get_user_company_id(auth.uid())
    )
  )
);

-- 3. project_stages: scope manage policy to user's company
DROP POLICY IF EXISTS "Managers can manage stages" ON public.project_stages;
CREATE POLICY "Managers can manage stages in their company"
ON public.project_stages
FOR ALL
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    (has_role(auth.uid(), 'admin'::user_role)
     OR has_role(auth.uid(), 'director'::user_role)
     OR has_role(auth.uid(), 'supervisor'::user_role)
     OR has_role(auth.uid(), 'leader'::user_role))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_stages.project_id
        AND p.company_id = get_user_company_id(auth.uid())
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    (has_role(auth.uid(), 'admin'::user_role)
     OR has_role(auth.uid(), 'director'::user_role)
     OR has_role(auth.uid(), 'supervisor'::user_role)
     OR has_role(auth.uid(), 'leader'::user_role))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_stages.project_id
        AND p.company_id = get_user_company_id(auth.uid())
    )
  )
);

-- 4. project_tasks: scope manage policy to user's company
DROP POLICY IF EXISTS "Managers can manage tasks" ON public.project_tasks;
CREATE POLICY "Managers can manage tasks in their company"
ON public.project_tasks
FOR ALL
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    (has_role(auth.uid(), 'admin'::user_role)
     OR has_role(auth.uid(), 'director'::user_role)
     OR has_role(auth.uid(), 'supervisor'::user_role)
     OR has_role(auth.uid(), 'leader'::user_role))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_tasks.project_id
        AND p.company_id = get_user_company_id(auth.uid())
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    (has_role(auth.uid(), 'admin'::user_role)
     OR has_role(auth.uid(), 'director'::user_role)
     OR has_role(auth.uid(), 'supervisor'::user_role)
     OR has_role(auth.uid(), 'leader'::user_role))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_tasks.project_id
        AND p.company_id = get_user_company_id(auth.uid())
    )
  )
);

-- 5. report_signatures: drop redundant unbounded SELECT policy
DROP POLICY IF EXISTS "Users can view signatures" ON public.report_signatures;

-- 6. system_settings: restrict admin SELECT (owner contact data) to super_admin only.
-- Public-facing branding remains accessible via the SECURITY DEFINER function get_public_branding().
DROP POLICY IF EXISTS "Admins can read system settings" ON public.system_settings;
CREATE POLICY "Super admins can read system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins podem gerenciar configurações do sistema" ON public.system_settings;
CREATE POLICY "Super admins manage system settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- 7. user_companies: remove self-insert privilege escalation
DROP POLICY IF EXISTS "Users can insert their own company associations" ON public.user_companies;
CREATE POLICY "Admins manage company associations"
ON public.user_companies
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
);

DROP POLICY IF EXISTS "Users can delete their own company associations" ON public.user_companies;
CREATE POLICY "Admins delete company associations"
ON public.user_companies
FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
);
