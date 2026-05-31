-- Allow NULL email for WhatsApp signers
ALTER TABLE autentique_signers 
ALTER COLUMN email DROP NOT NULL;