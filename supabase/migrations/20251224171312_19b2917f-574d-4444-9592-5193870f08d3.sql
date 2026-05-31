-- Add pdf_logo_url column to system_settings table
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS pdf_logo_url TEXT;