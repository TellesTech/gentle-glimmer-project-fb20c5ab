ALTER TABLE public.whatsapp_integration_settings ADD COLUMN IF NOT EXISTS alert_contacts jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.whatsapp_integration_settings
SET alert_contacts = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', '', 'phone', p)), '[]'::jsonb)
  FROM unnest(alert_phones) AS p
)
WHERE cardinality(alert_phones) > 0 AND jsonb_array_length(alert_contacts) = 0;