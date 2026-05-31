-- Adicionar campo para avatar do assistente IA Wesley
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS ai_avatar_url text DEFAULT NULL;

COMMENT ON COLUMN public.system_settings.ai_avatar_url IS 'URL do avatar personalizado do assistente IA Wesley';