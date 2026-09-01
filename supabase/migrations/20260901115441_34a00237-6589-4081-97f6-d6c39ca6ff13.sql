CREATE TABLE public.whatsapp_integration_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_url text NOT NULL DEFAULT 'https://chatwees.uazapi.com',
  webhook_url text,
  webhook_events text[] NOT NULL DEFAULT ARRAY['messages','messages_update','connection']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.whatsapp_integration_settings TO authenticated;
GRANT ALL ON public.whatsapp_integration_settings TO service_role;

ALTER TABLE public.whatsapp_integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage whatsapp integration settings"
ON public.whatsapp_integration_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_whatsapp_integration_settings_updated_at
BEFORE UPDATE ON public.whatsapp_integration_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.whatsapp_integration_settings (base_url) VALUES ('https://chatwees.uazapi.com');

CREATE OR REPLACE FUNCTION public.get_whatsapp_runtime_config()
RETURNS TABLE(base_url text, webhook_url text, webhook_events text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.base_url, s.webhook_url, s.webhook_events
  FROM public.whatsapp_integration_settings s
  ORDER BY s.created_at
  LIMIT 1
$$;