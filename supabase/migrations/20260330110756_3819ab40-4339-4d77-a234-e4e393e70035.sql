
-- 1. Fix ai_alert_notifications: drop overly permissive policy, replace with scoped one
DROP POLICY IF EXISTS "Service role can manage all notifications" ON public.ai_alert_notifications;

CREATE POLICY "Users can manage their own notifications"
  ON public.ai_alert_notifications
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Fix report_history: scope SELECT to user's company reports
DROP POLICY IF EXISTS "Users can view report history" ON public.report_history;

CREATE POLICY "Users can view report history for their reports"
  ON public.report_history
  FOR SELECT
  TO authenticated
  USING (
    report_id IN (
      SELECT r.id FROM reports r
      JOIN projects p ON p.id = r.project_id
      WHERE p.company_id = get_user_company_id(auth.uid())
    )
    OR has_role(auth.uid(), 'super_admin'::user_role)
  );

-- 3. Fix user_roles: scope director/admin role management to same company
DROP POLICY IF EXISTS "Admins and Directors can manage roles" ON public.user_roles;

CREATE POLICY "Admins and Directors can manage roles in their company"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    (
      has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
    )
    AND (
      user_id IN (
        SELECT id FROM profiles
        WHERE company_id = get_user_company_id(auth.uid())
      )
    )
  )
  WITH CHECK (
    (
      has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
    )
    AND (
      user_id IN (
        SELECT id FROM profiles
        WHERE company_id = get_user_company_id(auth.uid())
      )
    )
  );

-- 4. Fix admin-exports storage: remove public read policies
DROP POLICY IF EXISTS "Public read access for admin-exports" ON storage.objects;
DROP POLICY IF EXISTS "Public read admin-exports" ON storage.objects;
