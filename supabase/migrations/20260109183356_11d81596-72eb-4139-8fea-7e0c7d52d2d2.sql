-- Função para obter estatísticas da página de login (acessível sem autenticação)
CREATE OR REPLACE FUNCTION public.get_login_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_reports INTEGER;
  active_projects INTEGER;
  sent_reports INTEGER;
  approval_rate INTEGER;
BEGIN
  -- Contar total de relatórios
  SELECT COUNT(*) INTO total_reports FROM reports;
  
  -- Contar projetos ativos (in_progress)
  SELECT COUNT(*) INTO active_projects FROM projects WHERE status = 'in_progress';
  
  -- Contar relatórios enviados
  SELECT COUNT(*) INTO sent_reports FROM reports WHERE status = 'sent';
  
  -- Calcular taxa de aprovação
  IF total_reports > 0 THEN
    approval_rate := ROUND((sent_reports::NUMERIC / total_reports) * 100);
  ELSE
    approval_rate := 0;
  END IF;
  
  RETURN json_build_object(
    'totalReports', total_reports,
    'activeProjects', active_projects,
    'approvalRate', approval_rate
  );
END;
$$;

-- Permitir acesso anônimo à função
GRANT EXECUTE ON FUNCTION public.get_login_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_login_stats() TO authenticated;