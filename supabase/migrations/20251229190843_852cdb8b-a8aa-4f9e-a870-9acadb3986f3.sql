-- Add client fields to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS contract_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS client_notes text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_client_active boolean DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS responsible_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS responsible_email text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS responsible_phone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS responsible_role text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS zip_code text;

-- Create company_contacts table for approval contacts
CREATE TABLE IF NOT EXISTS public.company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  role text,
  can_approve boolean DEFAULT true,
  is_active boolean DEFAULT true,
  signature_data text,
  user_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, email)
);

-- Enable RLS
ALTER TABLE public.company_contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company_contacts
CREATE POLICY "Admins can manage company contacts"
ON public.company_contacts
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'director'::user_role) OR 
  has_role(auth.uid(), 'supervisor'::user_role) OR
  has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Contacts can view own record"
ON public.company_contacts
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Contacts can update own record"
ON public.company_contacts
FOR UPDATE
USING (user_id = auth.uid());

-- Create report_company_approvers table
CREATE TABLE IF NOT EXISTS public.report_company_approvers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.company_contacts(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  approved_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(report_id, contact_id)
);

-- Enable RLS
ALTER TABLE public.report_company_approvers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for report_company_approvers
CREATE POLICY "Admins can manage report approvers"
ON public.report_company_approvers
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'director'::user_role) OR 
  has_role(auth.uid(), 'supervisor'::user_role) OR
  has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Contacts can view their assigned reports"
ON public.report_company_approvers
FOR SELECT
USING (
  contact_id IN (
    SELECT id FROM public.company_contacts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Contacts can update their approval status"
ON public.report_company_approvers
FOR UPDATE
USING (
  contact_id IN (
    SELECT id FROM public.company_contacts WHERE user_id = auth.uid()
  )
);

-- Create function to get contact id for current user
CREATE OR REPLACE FUNCTION public.get_company_contact_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.company_contacts
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Create function to check if user is a company contact
CREATE OR REPLACE FUNCTION public.is_company_contact(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_contacts
    WHERE user_id = _user_id AND is_active = true
  )
$$;

-- Create function to get project ids for company contacts
CREATE OR REPLACE FUNCTION public.get_contact_project_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r.project_id 
  FROM reports r
  INNER JOIN report_company_approvers rca ON rca.report_id = r.id
  INNER JOIN company_contacts cc ON cc.id = rca.contact_id
  WHERE cc.user_id = _user_id
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_company_contacts_updated_at
  BEFORE UPDATE ON public.company_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate data from client_profiles to company_contacts
INSERT INTO public.company_contacts (company_id, name, email, phone, role, can_approve, is_active, signature_data, user_id, created_at, updated_at)
SELECT 
  cc.company_id,
  cp.name,
  cp.email,
  cp.phone,
  cp.role,
  COALESCE(cp.can_approve, true),
  COALESCE(cp.is_active, true),
  cp.signature_data,
  cp.user_id,
  cp.created_at,
  cp.updated_at
FROM public.client_profiles cp
INNER JOIN public.client_companies cc ON cc.client_id = cp.id
ON CONFLICT (company_id, email) DO NOTHING;

-- Migrate report_client_approvers to report_company_approvers
INSERT INTO public.report_company_approvers (report_id, contact_id, status, approved_at, created_by, created_at)
SELECT 
  rca.report_id,
  cc.id,
  rca.status,
  rca.approved_at,
  rca.created_by,
  rca.created_at
FROM public.report_client_approvers rca
INNER JOIN public.client_profiles cp ON cp.id = rca.client_id
INNER JOIN public.client_companies clc ON clc.client_id = cp.id
INNER JOIN public.company_contacts cc ON cc.company_id = clc.company_id AND cc.email = cp.email
ON CONFLICT (report_id, contact_id) DO NOTHING;