-- Add invitation tracking columns to company_contacts
ALTER TABLE public.company_contacts 
ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invitation_count INT DEFAULT 0;