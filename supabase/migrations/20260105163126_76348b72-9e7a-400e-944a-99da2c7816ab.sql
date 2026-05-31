-- Add ai_summary column to reports table
ALTER TABLE public.reports 
ADD COLUMN ai_summary TEXT;