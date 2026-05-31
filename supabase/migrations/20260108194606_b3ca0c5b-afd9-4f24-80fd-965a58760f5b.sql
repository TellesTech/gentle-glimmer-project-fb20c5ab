-- Tabela para armazenar dados de avanço físico semanal por projeto
CREATE TABLE public.project_weekly_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  planned_period NUMERIC(5,2) DEFAULT 0,
  actual_period NUMERIC(5,2) DEFAULT 0,
  planned_presence INTEGER DEFAULT 0,
  actual_presence INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(project_id, date)
);

-- Index for faster queries by project
CREATE INDEX idx_project_weekly_progress_project_id ON public.project_weekly_progress(project_id);
CREATE INDEX idx_project_weekly_progress_date ON public.project_weekly_progress(project_id, date);

-- Enable RLS
ALTER TABLE public.project_weekly_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view progress"
  ON public.project_weekly_progress FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert progress"
  ON public.project_weekly_progress FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update progress"
  ON public.project_weekly_progress FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete progress"
  ON public.project_weekly_progress FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_project_weekly_progress_updated_at
  BEFORE UPDATE ON public.project_weekly_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();