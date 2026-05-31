-- Add signed_file_url column to autentique_documents to store the URL of the signed PDF
ALTER TABLE public.autentique_documents ADD COLUMN IF NOT EXISTS signed_file_url TEXT;