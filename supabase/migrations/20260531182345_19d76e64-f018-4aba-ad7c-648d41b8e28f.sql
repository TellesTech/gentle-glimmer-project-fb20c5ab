-- Add slug column to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Create WhatsApp tables
CREATE TABLE IF NOT EXISTS public.whatsapp_group_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL UNIQUE,
  group_name TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  created_by UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_rdo_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE,
  group_id TEXT,
  sender_phone TEXT,
  sender_name TEXT,
  status TEXT DEFAULT 'pending',
  report_id UUID REFERENCES public.reports(id),
  report_date DATE,
  error_message TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and grant permissions
ALTER TABLE public.whatsapp_group_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_rdo_logs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.whatsapp_group_projects TO authenticated, service_role, anon;
GRANT ALL ON public.whatsapp_rdo_logs TO authenticated, service_role, anon;

-- Simple policies
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can manage whatsapp mappings' AND tablename = 'whatsapp_group_projects') THEN
    CREATE POLICY "Anyone can manage whatsapp mappings" ON public.whatsapp_group_projects FOR ALL USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can manage whatsapp logs' AND tablename = 'whatsapp_rdo_logs') THEN
    CREATE POLICY "Anyone can manage whatsapp logs" ON public.whatsapp_rdo_logs FOR ALL USING (true);
  END IF;
END $$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
