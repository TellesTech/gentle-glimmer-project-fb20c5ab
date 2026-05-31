-- Criar função para obter os IDs dos projetos associados ao usuário através de suas equipes
CREATE OR REPLACE FUNCTION public.get_user_project_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT t.project_id
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.user_id = _user_id
$$;

-- Remover policy antiga de visualização de projetos
DROP POLICY IF EXISTS "Users can view their company projects" ON public.projects;

-- Criar nova policy: admins veem todos da empresa, outros veem apenas onde estão em equipe
CREATE POLICY "Users can view their company projects" ON public.projects
FOR SELECT USING (
  -- Admins, diretores, supervisores e super_admin veem todos os projetos da empresa
  (
    (company_id = get_user_company_id(auth.uid())) AND (
      has_role(auth.uid(), 'admin'::user_role) OR 
      has_role(auth.uid(), 'director'::user_role) OR 
      has_role(auth.uid(), 'supervisor'::user_role) OR
      has_role(auth.uid(), 'super_admin'::user_role)
    )
  )
  OR
  -- Usuários comuns (leader, hr, collaborator) veem apenas projetos onde estão em uma equipe
  (id IN (SELECT get_user_project_ids(auth.uid())))
);