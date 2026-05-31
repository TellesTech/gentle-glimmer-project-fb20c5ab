-- Create contact_sites table
CREATE TABLE IF NOT EXISTS public.contact_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.company_contacts(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(contact_id, site_id)
);

ALTER TABLE public.contact_sites ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.contact_sites TO authenticated, service_role;

-- Add policies for contact_sites
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can manage contact_sites' AND tablename = 'contact_sites') THEN
    CREATE POLICY "Anyone can manage contact_sites" ON public.contact_sites FOR ALL USING (true);
  END IF;
END $$;

-- Add missing columns to various tables
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS progress_target NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_planned_workforce INTEGER DEFAULT 0;

ALTER TABLE public.reports 
  ADD COLUMN IF NOT EXISTS signed_pdf_url TEXT;

ALTER TABLE public.report_signatures 
  ADD COLUMN IF NOT EXISTS signer_user_id UUID REFERENCES auth.users(id);

ALTER TABLE public.portal_admin_access 
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE;

ALTER TABLE public.ai_conversations 
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.company_contacts(id) ON DELETE CASCADE;

-- Reload schema
NOTIFY pgrst, 'reload schema';
