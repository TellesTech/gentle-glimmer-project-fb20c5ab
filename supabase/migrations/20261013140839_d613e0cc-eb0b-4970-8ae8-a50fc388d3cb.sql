ALTER TABLE public.whatsapp_integration_settings ADD COLUMN IF NOT EXISTS alert_phones text[] NOT NULL DEFAULT '{}';
UPDATE public.whatsapp_integration_settings
SET alert_phones = ARRAY[alert_phone]
WHERE alert_phone IS NOT NULL AND btrim(alert_phone) <> '' AND cardinality(alert_phones) = 0;