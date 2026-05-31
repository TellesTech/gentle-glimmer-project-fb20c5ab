-- Add new columns to client_profiles
ALTER TABLE client_profiles
ADD COLUMN IF NOT EXISTS contract_number text,
ADD COLUMN IF NOT EXISTS cnpj text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS notes text;

-- Create client_companies junction table
CREATE TABLE IF NOT EXISTS client_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, company_id)
);

-- Create client_sites junction table
CREATE TABLE IF NOT EXISTS client_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, site_id)
);

-- Enable RLS on new tables
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_sites ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_companies
CREATE POLICY "Admins can manage client companies"
ON client_companies FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'director'::user_role) OR 
  has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Users can view client companies"
ON client_companies FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'director'::user_role) OR 
  has_role(auth.uid(), 'supervisor'::user_role)
);

-- RLS policies for client_sites
CREATE POLICY "Admins can manage client sites"
ON client_sites FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'director'::user_role) OR 
  has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Users can view client sites"
ON client_sites FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'director'::user_role) OR 
  has_role(auth.uid(), 'supervisor'::user_role)
);