-- Adicionar coluna para controlar modo de cálculo de progresso
ALTER TABLE public.reports 
  ADD COLUMN IF NOT EXISTS use_weighted_progress BOOLEAN DEFAULT false;

-- Criar tabela para etapas de atividade com peso
CREATE TABLE IF NOT EXISTS public.report_activity_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1 CHECK (weight > 0),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca por relatório
CREATE INDEX IF NOT EXISTS idx_report_activity_steps_report_id 
  ON public.report_activity_steps(report_id);

-- Habilitar RLS
ALTER TABLE public.report_activity_steps ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem visualizar etapas de relatórios que têm acesso
CREATE POLICY "Users can view activity steps for accessible reports"
  ON public.report_activity_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      JOIN public.projects p ON r.project_id = p.id
      JOIN public.profiles pr ON pr.company_id = p.company_id
      WHERE r.id = report_activity_steps.report_id
        AND pr.id = auth.uid()
    )
  );

-- Política: usuários autenticados podem inserir etapas em relatórios que têm acesso
CREATE POLICY "Users can insert activity steps for accessible reports"
  ON public.report_activity_steps
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reports r
      JOIN public.projects p ON r.project_id = p.id
      JOIN public.profiles pr ON pr.company_id = p.company_id
      WHERE r.id = report_activity_steps.report_id
        AND pr.id = auth.uid()
    )
  );

-- Política: usuários autenticados podem atualizar etapas de relatórios que têm acesso
CREATE POLICY "Users can update activity steps for accessible reports"
  ON public.report_activity_steps
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      JOIN public.projects p ON r.project_id = p.id
      JOIN public.profiles pr ON pr.company_id = p.company_id
      WHERE r.id = report_activity_steps.report_id
        AND pr.id = auth.uid()
    )
  );

-- Política: usuários autenticados podem deletar etapas de relatórios que têm acesso
CREATE POLICY "Users can delete activity steps for accessible reports"
  ON public.report_activity_steps
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      JOIN public.projects p ON r.project_id = p.id
      JOIN public.profiles pr ON pr.company_id = p.company_id
      WHERE r.id = report_activity_steps.report_id
        AND pr.id = auth.uid()
    )
  );