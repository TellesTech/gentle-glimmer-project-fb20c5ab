ALTER TABLE public.whatsapp_integration_settings
  ADD COLUMN IF NOT EXISTS instance_name text,
  ADD COLUMN IF NOT EXISTS instance_token text;

DROP FUNCTION IF EXISTS public.get_whatsapp_runtime_config();
CREATE FUNCTION public.get_whatsapp_runtime_config()
RETURNS TABLE(base_url text, webhook_url text, webhook_events text[], instance_name text, instance_token text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.base_url, s.webhook_url, s.webhook_events, s.instance_name, s.instance_token
  FROM public.whatsapp_integration_settings s
  ORDER BY s.created_at ASC
  LIMIT 1;
$$;