-- Create table for daily workforce planning
CREATE TABLE public.project_daily_workforce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  planned_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, date)
);

-- Add default planned workforce to projects table
ALTER TABLE public.projects ADD COLUMN default_planned_workforce INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.project_daily_workforce ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can read project_daily_workforce" 
  ON public.project_daily_workforce FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert project_daily_workforce" 
  ON public.project_daily_workforce FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update project_daily_workforce" 
  ON public.project_daily_workforce FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete project_daily_workforce" 
  ON public.project_daily_workforce FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_project_daily_workforce_updated_at
  BEFORE UPDATE ON public.project_daily_workforce
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();