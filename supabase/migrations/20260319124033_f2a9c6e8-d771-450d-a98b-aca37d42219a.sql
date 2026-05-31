
-- Enum for service report status
CREATE TYPE public.service_report_status AS ENUM ('draft', 'completed', 'published');

-- Enum for section type
CREATE TYPE public.service_section_type AS ENUM ('execution', 'safety', 'scope', 'conclusion', 'custom');

-- Enum for photo layout
CREATE TYPE public.service_photo_layout AS ENUM ('full', 'half', 'third');

-- Main service reports table
CREATE TABLE public.service_reports (
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
  status service_report_status NOT NULL DEFAULT 'draft',
  revision INTEGER NOT NULL DEFAULT 0,
  code TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sections table
CREATE TABLE public.service_report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.service_reports(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content JSONB DEFAULT '[]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  section_type service_section_type NOT NULL DEFAULT 'execution',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Photos table
CREATE TABLE public.service_report_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.service_report_sections(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  annotations JSONB DEFAULT '[]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  layout service_photo_layout NOT NULL DEFAULT 'half',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated at triggers
CREATE TRIGGER update_service_reports_updated_at
  BEFORE UPDATE ON public.service_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_report_sections_updated_at
  BEFORE UPDATE ON public.service_report_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.service_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_report_photos ENABLE ROW LEVEL SECURITY;

-- RLS for service_reports
CREATE POLICY "Users can view service reports from their company"
  ON public.service_reports FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::user_role)
  );

CREATE POLICY "Users can insert service reports for their company"
  ON public.service_reports FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::user_role)
  );

CREATE POLICY "Users can update service reports from their company"
  ON public.service_reports FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::user_role)
  );

CREATE POLICY "Users can delete service reports from their company"
  ON public.service_reports FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::user_role)
  );

-- RLS for sections (inherit from parent report)
CREATE POLICY "Users can manage sections of accessible reports"
  ON public.service_report_sections FOR ALL TO authenticated
  USING (
    report_id IN (SELECT id FROM public.service_reports WHERE company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::user_role))
  )
  WITH CHECK (
    report_id IN (SELECT id FROM public.service_reports WHERE company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::user_role))
  );

-- RLS for photos (inherit from parent section -> report)
CREATE POLICY "Users can manage photos of accessible sections"
  ON public.service_report_photos FOR ALL TO authenticated
  USING (
    section_id IN (
      SELECT s.id FROM public.service_report_sections s
      JOIN public.service_reports r ON r.id = s.report_id
      WHERE r.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::user_role)
    )
  )
  WITH CHECK (
    section_id IN (
      SELECT s.id FROM public.service_report_sections s
      JOIN public.service_reports r ON r.id = s.report_id
      WHERE r.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::user_role)
    )
  );

-- Storage bucket for service report photos
INSERT INTO storage.buckets (id, name, public) VALUES ('service-report-photos', 'service-report-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Authenticated users can upload service report photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-report-photos');

CREATE POLICY "Anyone can view service report photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'service-report-photos');

CREATE POLICY "Authenticated users can delete service report photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'service-report-photos');
