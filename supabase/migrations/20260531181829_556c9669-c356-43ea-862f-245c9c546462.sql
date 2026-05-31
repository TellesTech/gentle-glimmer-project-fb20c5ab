-- Create project_milestones table
CREATE TABLE IF NOT EXISTS public.project_milestones (
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

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.project_milestones TO authenticated, service_role;

-- Create project_daily_workforce table
CREATE TABLE IF NOT EXISTS public.project_daily_workforce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  planned_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, date)
);

ALTER TABLE public.project_daily_workforce ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.project_daily_workforce TO authenticated, service_role;

-- Add missing columns to reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS maintenance_order_number TEXT;

-- Add missing columns to project_stages
ALTER TABLE public.project_stages 
ADD COLUMN IF NOT EXISTS total_quantity NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT NULL;

-- Simple policies for new tables
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can manage milestones' AND tablename = 'project_milestones') THEN
    CREATE POLICY "Anyone can manage milestones" ON public.project_milestones FOR ALL USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can manage daily workforce' AND tablename = 'project_daily_workforce') THEN
    CREATE POLICY "Anyone can manage daily workforce" ON public.project_daily_workforce FOR ALL USING (true);
  END IF;
END $$;
