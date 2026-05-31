-- Add archive columns to autentique_documents
ALTER TABLE public.autentique_documents
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN archived_by UUID DEFAULT NULL;

-- Add index for faster filtering
CREATE INDEX idx_autentique_documents_archived ON public.autentique_documents (archived_at) WHERE archived_at IS NULL;