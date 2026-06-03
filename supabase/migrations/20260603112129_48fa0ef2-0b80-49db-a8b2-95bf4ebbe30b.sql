-- =========================================================
-- 1) whatsapp_group_projects: remove open ALL policy
-- =========================================================
DROP POLICY IF EXISTS "Anyone can manage whatsapp mappings" ON public.whatsapp_group_projects;

CREATE POLICY "Authenticated team can view whatsapp mappings"
ON public.whatsapp_group_projects
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'supervisor'::user_role)
  OR has_role(auth.uid(), 'leader'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Admins can manage whatsapp mappings"
ON public.whatsapp_group_projects
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- =========================================================
-- 2) whatsapp_rdo_logs: remove open ALL policy
-- =========================================================
DROP POLICY IF EXISTS "Anyone can manage whatsapp logs" ON public.whatsapp_rdo_logs;

CREATE POLICY "Admins can view whatsapp rdo logs"
ON public.whatsapp_rdo_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'supervisor'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Admins can manage whatsapp rdo logs"
ON public.whatsapp_rdo_logs
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- =========================================================
-- 3) workforce_database: company-scoped access
-- =========================================================
DROP POLICY IF EXISTS "Anyone can manage workforce data" ON public.workforce_database;

CREATE POLICY "Company members can view workforce data"
ON public.workforce_database
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Company team can manage workforce data"
ON public.workforce_database
FOR ALL
TO authenticated
USING (
  (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
      OR has_role(auth.uid(), 'supervisor'::user_role)
      OR has_role(auth.uid(), 'leader'::user_role)
    )
  )
  OR has_role(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
      OR has_role(auth.uid(), 'supervisor'::user_role)
      OR has_role(auth.uid(), 'leader'::user_role)
    )
  )
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- =========================================================
-- 4) workforce_delays: company-scoped access
-- =========================================================
DROP POLICY IF EXISTS "Anyone can manage workforce delays" ON public.workforce_delays;

CREATE POLICY "Company members can view workforce delays"
ON public.workforce_delays
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Company team can manage workforce delays"
ON public.workforce_delays
FOR ALL
TO authenticated
USING (
  (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
      OR has_role(auth.uid(), 'supervisor'::user_role)
      OR has_role(auth.uid(), 'leader'::user_role)
    )
  )
  OR has_role(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
      OR has_role(auth.uid(), 'supervisor'::user_role)
      OR has_role(auth.uid(), 'leader'::user_role)
    )
  )
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- =========================================================
-- 5) autentique_signers: tighten policies to authenticated role
-- =========================================================
DROP POLICY IF EXISTS "Admins can manage signers" ON public.autentique_signers;
DROP POLICY IF EXISTS "Signers and admins can view signer info" ON public.autentique_signers;

CREATE POLICY "Admins can manage autentique signers"
ON public.autentique_signers
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'supervisor'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'supervisor'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Signers and admins can view autentique signer info"
ON public.autentique_signers
FOR SELECT
TO authenticated
USING (
  client_id = get_client_profile_id(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM autentique_documents d
    JOIN reports r ON r.id = d.report_id
    WHERE d.id = autentique_signers.document_id
      AND (
        r.created_by = auth.uid()
        OR has_role(auth.uid(), 'admin'::user_role)
        OR has_role(auth.uid(), 'director'::user_role)
        OR has_role(auth.uid(), 'supervisor'::user_role)
        OR has_role(auth.uid(), 'super_admin'::user_role)
      )
  )
);

-- =========================================================
-- 6) clicksign_signers: tighten policies to authenticated role
-- =========================================================
DROP POLICY IF EXISTS "Admins can manage signers" ON public.clicksign_signers;
DROP POLICY IF EXISTS "Signers and admins can view signer info" ON public.clicksign_signers;

CREATE POLICY "Admins can manage clicksign signers"
ON public.clicksign_signers
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'supervisor'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'supervisor'::user_role)
);

CREATE POLICY "Signers and admins can view clicksign signer info"
ON public.clicksign_signers
FOR SELECT
TO authenticated
USING (
  client_id = get_client_profile_id(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM clicksign_documents d
    JOIN reports r ON r.id = d.report_id
    WHERE d.id = clicksign_signers.document_id
      AND (
        r.created_by = auth.uid()
        OR has_role(auth.uid(), 'admin'::user_role)
        OR has_role(auth.uid(), 'director'::user_role)
        OR has_role(auth.uid(), 'supervisor'::user_role)
      )
  )
);

-- =========================================================
-- 7) company-photos storage: restrict writes to team admins
-- =========================================================
DROP POLICY IF EXISTS "Authenticated upload company photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update company photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete company photos" ON storage.objects;

CREATE POLICY "Team admins can upload company photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-photos'
  AND (
    has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'director'::user_role)
    OR has_role(auth.uid(), 'supervisor'::user_role)
    OR has_role(auth.uid(), 'super_admin'::user_role)
  )
);

CREATE POLICY "Team admins can update company photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-photos'
  AND (
    has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'director'::user_role)
    OR has_role(auth.uid(), 'supervisor'::user_role)
    OR has_role(auth.uid(), 'super_admin'::user_role)
  )
)
WITH CHECK (
  bucket_id = 'company-photos'
  AND (
    has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'director'::user_role)
    OR has_role(auth.uid(), 'supervisor'::user_role)
    OR has_role(auth.uid(), 'super_admin'::user_role)
  )
);

CREATE POLICY "Team admins can delete company photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-photos'
  AND (
    has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'director'::user_role)
    OR has_role(auth.uid(), 'supervisor'::user_role)
    OR has_role(auth.uid(), 'super_admin'::user_role)
  )
);

-- =========================================================
-- 8) user_roles: prevent privilege escalation
-- =========================================================
DROP POLICY IF EXISTS "Admins and Directors can manage roles" ON public.user_roles;

-- Keep existing "Users can view limited roles" SELECT policy, scope it to authenticated
DROP POLICY IF EXISTS "Users can view limited roles" ON public.user_roles;

CREATE POLICY "Users and admins can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'supervisor'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- INSERT already covered by existing "Only admins can insert user roles" (authenticated, WITH CHECK)
-- Add explicit UPDATE/DELETE restricted to admins
CREATE POLICY "Only admins can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Only admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);