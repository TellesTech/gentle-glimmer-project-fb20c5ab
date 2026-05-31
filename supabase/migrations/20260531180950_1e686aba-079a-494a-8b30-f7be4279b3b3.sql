-- Add missing columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'fixo';

-- Ensure permissions are set for the new columns (though they usually inherit from the table)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Reload schema cache to reflect changes
NOTIFY pgrst, 'reload schema';
