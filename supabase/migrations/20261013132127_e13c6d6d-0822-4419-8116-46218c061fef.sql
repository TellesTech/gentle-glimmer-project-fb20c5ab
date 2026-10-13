ALTER TABLE public.whatsapp_integration_settings
  ADD COLUMN IF NOT EXISTS connection_status text,
  ADD COLUMN IF NOT EXISTS connection_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disconnect_alerted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_disconnect_reason text;