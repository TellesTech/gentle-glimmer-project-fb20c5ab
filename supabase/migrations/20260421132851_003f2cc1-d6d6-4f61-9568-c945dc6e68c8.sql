-- Atualiza o título padrão do alerta de assinatura e migra registros antigos que ainda mencionam "SuperSign"
ALTER TABLE public.client_portal_settings
  ALTER COLUMN no_signature_alert_title SET DEFAULT 'Assinatura WEES não configurada';

UPDATE public.client_portal_settings
SET no_signature_alert_title = 'Assinatura WEES não configurada'
WHERE no_signature_alert_title ILIKE '%supersign%' OR no_signature_alert_title = 'SuperSign não configurada';