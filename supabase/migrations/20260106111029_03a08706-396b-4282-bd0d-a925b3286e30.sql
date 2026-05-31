-- Adicionar coluna para armazenar o hash do PIN de 4 dígitos
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Comentário explicativo
COMMENT ON COLUMN public.profiles.pin_hash IS 'Hash do PIN de 4 dígitos para login rápido';