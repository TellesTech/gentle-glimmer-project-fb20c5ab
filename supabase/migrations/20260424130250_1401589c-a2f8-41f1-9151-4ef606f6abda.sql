DROP FUNCTION IF EXISTS public.audit_afd_vs_rdo(uuid, date, date, integer);
DROP TABLE IF EXISTS public.time_clock_records CASCADE;
DROP TABLE IF EXISTS public.time_clock_imports CASCADE;
DROP INDEX IF EXISTS public.idx_profiles_pis;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pis;