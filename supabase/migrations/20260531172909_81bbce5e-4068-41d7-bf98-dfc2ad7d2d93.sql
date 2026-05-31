-- Adiciona a coluna pin_hash à tabela profiles se não existir
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Comentário na coluna
COMMENT ON COLUMN public.profiles.pin_hash IS 'Hash do PIN de 4 dígitos para login rápido';

-- Cria a função get_quick_access_users
CREATE OR REPLACE FUNCTION public.get_quick_access_users()
RETURNS TABLE(id uuid, name text, avatar_url text, has_pin boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    id,
    name,
    avatar_url,
    true as has_pin
  FROM profiles
  WHERE pin_hash IS NOT NULL AND pin_hash != ''
  ORDER BY name;
$$;

-- Concede permissões
GRANT EXECUTE ON FUNCTION public.get_quick_access_users() TO anon;
GRANT EXECUTE ON FUNCTION public.get_quick_access_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quick_access_users() TO service_role;
