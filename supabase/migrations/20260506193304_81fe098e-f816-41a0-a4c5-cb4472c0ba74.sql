ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'fixo';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_employment_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_employment_type_check
  CHECK (employment_type IN ('fixo', 'intermitente'));

UPDATE public.profiles SET employment_type = 'fixo' WHERE employment_type IS NULL;