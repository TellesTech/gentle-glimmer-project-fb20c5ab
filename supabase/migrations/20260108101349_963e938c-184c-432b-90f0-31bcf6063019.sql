-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Users can view suggestions from their company" ON feature_suggestions;
DROP POLICY IF EXISTS "Users can view suggestions" ON feature_suggestions;
DROP POLICY IF EXISTS "Users can create suggestions" ON feature_suggestions;
DROP POLICY IF EXISTS "Super admins can update suggestions" ON feature_suggestions;
DROP POLICY IF EXISTS "Super admins can delete suggestions" ON feature_suggestions;
DROP POLICY IF EXISTS "Admins can update suggestions" ON feature_suggestions;
DROP POLICY IF EXISTS "Admins can delete suggestions" ON feature_suggestions;

-- SELECT: Users can view suggestions from their company OR global (null company_id)
CREATE POLICY "Users can view suggestions" ON feature_suggestions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::user_role)
    OR (company_id = public.get_user_company_id(auth.uid()) AND company_id IS NOT NULL)
    OR company_id IS NULL
  );

-- INSERT: Users can create suggestions for their company or global
CREATE POLICY "Users can create suggestions" ON feature_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      company_id = public.get_user_company_id(auth.uid())
      OR company_id IS NULL
    )
  );

-- UPDATE: Admins and super_admins can update
CREATE POLICY "Admins can update suggestions" ON feature_suggestions
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::user_role)
    OR public.has_role(auth.uid(), 'admin'::user_role)
  );

-- DELETE: Admins and super_admins can delete
CREATE POLICY "Admins can delete suggestions" ON feature_suggestions
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::user_role)
    OR public.has_role(auth.uid(), 'admin'::user_role)
  );

-- Drop existing vote policies
DROP POLICY IF EXISTS "Users can view votes" ON suggestion_votes;
DROP POLICY IF EXISTS "Users can vote" ON suggestion_votes;
DROP POLICY IF EXISTS "Users can remove their votes" ON suggestion_votes;

-- SELECT: Users can view votes for suggestions they can see
CREATE POLICY "Users can view votes" ON suggestion_votes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::user_role)
    OR EXISTS (
      SELECT 1 FROM feature_suggestions fs
      WHERE fs.id = suggestion_votes.suggestion_id
      AND (
        fs.company_id = public.get_user_company_id(auth.uid())
        OR fs.company_id IS NULL
      )
    )
  );

-- INSERT: Users can vote on suggestions they can see
CREATE POLICY "Users can vote" ON suggestion_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM feature_suggestions fs
      WHERE fs.id = suggestion_id
      AND (
        fs.company_id = public.get_user_company_id(auth.uid())
        OR fs.company_id IS NULL
      )
    )
  );

-- DELETE: Users can remove their own votes
CREATE POLICY "Users can remove their votes" ON suggestion_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());