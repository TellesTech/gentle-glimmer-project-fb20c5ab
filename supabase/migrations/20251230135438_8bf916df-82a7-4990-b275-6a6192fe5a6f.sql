-- Add state column to profiles table for branch/subsidiary tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state text;