-- Tabela para armazenar marcos de avanço planejado (Linha Base / Curva S Planejada)
CREATE TABLE public.project_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  target_percentage NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  is_start_date BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, target_date),
  CONSTRAINT target_percentage_range CHECK (target_percentage >= 0 AND target_percentage <= 100)
);

-- Índices para performance
CREATE INDEX idx_project_milestones_project ON public.project_milestones(project_id);
CREATE INDEX idx_project_milestones_date ON public.project_milestones(target_date);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_project_milestones_updated_at
  BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins and supervisors can manage milestones" ON public.project_milestones
FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin'::user_role) OR
  public.has_role(auth.uid(), 'admin'::user_role) OR
  public.has_role(auth.uid(), 'director'::user_role) OR
  public.has_role(auth.uid(), 'supervisor'::user_role)
);

CREATE POLICY "All authenticated users can view milestones" ON public.project_milestones
FOR SELECT USING (auth.uid() IS NOT NULL);