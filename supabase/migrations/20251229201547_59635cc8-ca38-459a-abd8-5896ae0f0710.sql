-- Add daily_progress column to reports table for tracking daily advance percentage
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS daily_progress numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.reports.daily_progress IS 'Porcentagem de avanço do dia (0-100)';