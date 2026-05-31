-- Add new columns for responsible person and CEP to client_profiles
ALTER TABLE public.client_profiles
ADD COLUMN IF NOT EXISTS responsible_name text,
ADD COLUMN IF NOT EXISTS responsible_phone text,
ADD COLUMN IF NOT EXISTS responsible_email text,
ADD COLUMN IF NOT EXISTS responsible_role text,
ADD COLUMN IF NOT EXISTS zip_code text;

-- Add comment for documentation
COMMENT ON COLUMN public.client_profiles.responsible_name IS 'Nome do responsável da fábrica';
COMMENT ON COLUMN public.client_profiles.responsible_phone IS 'Telefone do responsável';
COMMENT ON COLUMN public.client_profiles.responsible_email IS 'Email do responsável';
COMMENT ON COLUMN public.client_profiles.responsible_role IS 'Cargo do responsável';
COMMENT ON COLUMN public.client_profiles.zip_code IS 'CEP do endereço';