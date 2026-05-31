-- Adicionar campos de cliente/contratante na tabela reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS client_company TEXT;