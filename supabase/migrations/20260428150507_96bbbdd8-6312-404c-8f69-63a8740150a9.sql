ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS internal_signer_names text[] NOT NULL DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.system_settings.internal_signer_names IS
  'Lista de nomes (case/acento-insensível) de assinantes ad-hoc — tipicamente via WhatsApp/Autentique sem email — que devem ser classificados como WEES na timeline de assinaturas, e não como cliente.';