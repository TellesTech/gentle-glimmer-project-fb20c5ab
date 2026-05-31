-- Habilitar Realtime para as tabelas de RDOs e Projetos
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;