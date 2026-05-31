-- Add signer_type column to distinguish between owner and client signers
ALTER TABLE autentique_signers
ADD COLUMN signer_type VARCHAR(20) DEFAULT 'client';

COMMENT ON COLUMN autentique_signers.signer_type IS 
  'Tipo do signatário: owner (responsável do sistema) ou client (cliente)';