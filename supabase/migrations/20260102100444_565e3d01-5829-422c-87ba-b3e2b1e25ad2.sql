-- Add signer owner fields to system_settings table
-- These fields define the system owner who will sign all documents automatically

ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS owner_email TEXT,
ADD COLUMN IF NOT EXISTS owner_role TEXT,
ADD COLUMN IF NOT EXISTS owner_phone TEXT;

COMMENT ON COLUMN system_settings.owner_name IS 'Nome do responsável que assinará os documentos em nome do sistema';
COMMENT ON COLUMN system_settings.owner_email IS 'Email do responsável para receber documentos de assinatura';
COMMENT ON COLUMN system_settings.owner_role IS 'Cargo do responsável (ex: Diretor Técnico)';
COMMENT ON COLUMN system_settings.owner_phone IS 'Telefone do responsável (opcional)';