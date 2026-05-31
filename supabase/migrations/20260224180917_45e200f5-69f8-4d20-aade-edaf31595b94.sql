-- Add new role values to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'coordinator';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'inspector';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'planner';