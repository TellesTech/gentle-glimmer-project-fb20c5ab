-- Create table to track sent notifications (avoid spam)
CREATE TABLE public.signature_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.autentique_documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES public.autentique_signers(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('admin_summary', 'signer_reminder')),
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.signature_notifications ENABLE ROW LEVEL SECURITY;

-- Only super admins can view notifications log
CREATE POLICY "Super admins can view notifications"
ON public.signature_notifications
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::user_role));

-- Indexes for efficient queries
CREATE INDEX idx_signature_notifications_document ON public.signature_notifications(document_id, sent_at DESC);
CREATE INDEX idx_signature_notifications_signer ON public.signature_notifications(signer_id, sent_at DESC);
CREATE INDEX idx_signature_notifications_type_sent ON public.signature_notifications(notification_type, sent_at DESC);

-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;