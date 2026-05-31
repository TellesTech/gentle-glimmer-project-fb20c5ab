-- Create enums if they don't exist
DO $$ BEGIN
    CREATE TYPE public.service_report_status AS ENUM ('draft', 'completed', 'published');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.service_section_type AS ENUM ('execution', 'safety', 'scope', 'conclusion', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.service_photo_layout AS ENUM ('full', 'half', 'third');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add missing columns to reports table
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS maintenance_order_title TEXT,
ADD COLUMN IF NOT EXISTS operational_deviation_hours NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS climatic_deviation_hours NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS amt_deviation_hours NUMERIC DEFAULT 0;

-- Add missing columns to company_contacts table
ALTER TABLE public.company_contacts
ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invitation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Main service reports table
CREATE TABLE IF NOT EXISTS public.service_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  client_name TEXT,
  client_unit TEXT,
  client_contact TEXT,
  subject TEXT,
  scope_description TEXT,
  start_date DATE,
  end_date DATE,
  safety_notes TEXT,
  conclusion TEXT,
  status public.service_report_status NOT NULL DEFAULT 'draft',
  revision INTEGER NOT NULL DEFAULT 0,
  code TEXT,
  cover_image_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sections table
CREATE TABLE IF NOT EXISTS public.service_report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.service_reports(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content JSONB DEFAULT '[]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  section_type public.service_section_type NOT NULL DEFAULT 'execution',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Photos table
CREATE TABLE IF NOT EXISTS public.service_report_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.service_report_sections(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  annotations JSONB DEFAULT '[]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  layout public.service_photo_layout NOT NULL DEFAULT 'half',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Portal admin access table
CREATE TABLE IF NOT EXISTS public.portal_admin_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.service_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_report_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_admin_access ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_report_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_report_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_admin_access TO authenticated;
GRANT ALL ON public.service_reports TO service_role;
GRANT ALL ON public.service_report_sections TO service_role;
GRANT ALL ON public.service_report_photos TO service_role;
GRANT ALL ON public.portal_admin_access TO service_role;

-- RLS for service_reports
CREATE POLICY "Users can view service reports from their company"
  ON public.service_reports FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::user_role)
  );

-- RLS for portal_admin_access
CREATE POLICY "Admins can manage portal access"
  ON public.portal_admin_access FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::user_role));

-- Storage bucket for service report photos
INSERT INTO storage.buckets (id, name, public) VALUES ('service-report-photos', 'service-report-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DO $$ BEGIN
    CREATE POLICY "Authenticated users can upload service report photos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'service-report-photos');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Anyone can view service report photos"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'service-report-photos');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
