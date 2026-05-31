ALTER TABLE public.backup_schedules 
  ADD COLUMN IF NOT EXISTS period_start_date date,
  ADD COLUMN IF NOT EXISTS period_end_date date;