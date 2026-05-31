-- Add missing roles to user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'master';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'client';

-- Ensure all tables in public have proper grants for service_role and authenticated
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
