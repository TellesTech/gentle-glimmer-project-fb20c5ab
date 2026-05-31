-- Criar trigger para novos usuários (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Inserir perfis para usuários que existem no auth.users mas não em profiles
INSERT INTO public.profiles (id, email, name)
SELECT 
  u.id, 
  u.email, 
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Inserir roles para usuários sem role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'collaborator'::user_role
FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id) DO NOTHING;

-- Criar bucket para avatares (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de RLS para o bucket avatars
CREATE POLICY "Qualquer um pode ver avatares"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Usuários autenticados podem fazer upload de avatares"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Admins podem atualizar avatares"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'director'::user_role) OR
    has_role(auth.uid(), 'supervisor'::user_role) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  ));

CREATE POLICY "Admins podem deletar avatares"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'director'::user_role) OR
    has_role(auth.uid(), 'supervisor'::user_role) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  ));