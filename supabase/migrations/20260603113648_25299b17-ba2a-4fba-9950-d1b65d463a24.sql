
-- 1) user_companies: bloquear self-insert (privilege escalation)
DROP POLICY IF EXISTS "Users can insert their own user_companies" ON public.user_companies;
DROP POLICY IF EXISTS "Authenticated users can insert their own user_companies" ON public.user_companies;
DROP POLICY IF EXISTS "Users can create their own associations" ON public.user_companies;

CREATE POLICY "Admins manage user_companies"
ON public.user_companies
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'director')
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'director')
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can view their own user_companies"
ON public.user_companies
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- 2) report_signatures: restringir leitura a admins/diretores/supervisores
DROP POLICY IF EXISTS "Users can view related report signatures" ON public.report_signatures;
DROP POLICY IF EXISTS "Users can view report signatures" ON public.report_signatures;

CREATE POLICY "Admins view report signatures"
ON public.report_signatures
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    EXISTS (
      SELECT 1
      FROM public.reports r
      JOIN public.projects pr ON pr.id = r.project_id
      JOIN public.sites s ON s.id = pr.site_id
      WHERE r.id = report_signatures.report_id
        AND s.company_id = public.get_user_company_id(auth.uid())
    )
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'director')
      OR public.has_role(auth.uid(), 'supervisor')
    )
  )
);

-- 3) autentique_signers / clicksign_signers: restringir SELECT a admins
DROP POLICY IF EXISTS "Authenticated users can view autentique_signers" ON public.autentique_signers;
DROP POLICY IF EXISTS "Users can view autentique signers from their reports" ON public.autentique_signers;
DROP POLICY IF EXISTS "Team can view autentique_signers" ON public.autentique_signers;

CREATE POLICY "Admins view autentique_signers"
ON public.autentique_signers
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'director')
  OR public.has_role(auth.uid(), 'supervisor')
);

DROP POLICY IF EXISTS "Authenticated users can view clicksign_signers" ON public.clicksign_signers;
DROP POLICY IF EXISTS "Users can view clicksign signers from their reports" ON public.clicksign_signers;
DROP POLICY IF EXISTS "Team can view clicksign_signers" ON public.clicksign_signers;

CREATE POLICY "Admins view clicksign_signers"
ON public.clicksign_signers
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'director')
  OR public.has_role(auth.uid(), 'supervisor')
);

-- 4) Storage: service-report-photos UPDATE/DELETE restritos a admins
DROP POLICY IF EXISTS "Authenticated users can update service report photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete service report photos" ON storage.objects;
DROP POLICY IF EXISTS "Any authenticated user can update service report photos" ON storage.objects;
DROP POLICY IF EXISTS "Any authenticated user can delete service report photos" ON storage.objects;

CREATE POLICY "Admins update service-report-photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'service-report-photos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'director')
    OR public.has_role(auth.uid(), 'supervisor')
  )
);

CREATE POLICY "Admins delete service-report-photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'service-report-photos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'director')
    OR public.has_role(auth.uid(), 'supervisor')
  )
);

-- 5) Restringir listagem dos buckets públicos (não afeta URLs públicas diretas via CDN)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public read service-report-photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view service report photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read company-photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view company photos" ON storage.objects;

CREATE POLICY "Authenticated list service-report-photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'service-report-photos');

CREATE POLICY "Authenticated list avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated list company-photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'company-photos');
