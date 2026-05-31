-- 1) Drop outdated UPDATE/DELETE policies referencing legacy roles
DROP POLICY IF EXISTS "Admins can update signatures" ON public.report_signatures;
DROP POLICY IF EXISTS "Admins can delete signatures" ON public.report_signatures;

-- 2) Allow internal users to insert their own WEES signature on accessible reports
CREATE POLICY "Internal users can insert their own signatures"
  ON public.report_signatures
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND signer_user_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'super_admin'::user_role)
      OR EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.id = report_signatures.report_id
          AND public.user_has_project_access(auth.uid(), r.project_id)
      )
    )
  );

-- 3) Recreate UPDATE/DELETE policies for current roles
CREATE POLICY "Admins can update signatures"
  ON public.report_signatures
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'super_admin'::user_role)
    OR public.has_role(auth.uid(), 'admin'::user_role)
  );

CREATE POLICY "Admins can delete signatures"
  ON public.report_signatures
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'super_admin'::user_role)
    OR public.has_role(auth.uid(), 'admin'::user_role)
  );