
-- Limpa duplicatas existentes (se houver) por attendance_id antes de adicionar o índice único
DELETE FROM public.workforce_database a
USING public.workforce_database b
WHERE a.ctid < b.ctid
  AND a.attendance_id IS NOT NULL
  AND a.attendance_id = b.attendance_id;

CREATE UNIQUE INDEX IF NOT EXISTS workforce_database_attendance_unique
  ON public.workforce_database(attendance_id)
  WHERE attendance_id IS NOT NULL;

ALTER TABLE public.workforce_delays
  ADD COLUMN IF NOT EXISTS report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS delay_source text;

CREATE UNIQUE INDEX IF NOT EXISTS workforce_delays_report_source_unique
  ON public.workforce_delays(report_id, delay_source)
  WHERE report_id IS NOT NULL AND delay_source IS NOT NULL;
