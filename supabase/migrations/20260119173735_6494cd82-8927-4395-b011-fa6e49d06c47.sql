-- Add weight column to project_stages table for weighted progress calculation
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 1 CHECK (weight > 0);

-- Add comment explaining the purpose
COMMENT ON COLUMN public.project_stages.weight IS 'Weight of this stage for weighted progress calculation';
