-- Inserir perfil do usuário
INSERT INTO public.profiles (id, email, name)
VALUES (
  'e1dce661-6dc7-4710-8ae2-4f607b53562d',
  'bissi@wees.com.br',
  'Bissi'
)
ON CONFLICT (id) DO NOTHING;

-- Inserir role como super_admin
INSERT INTO public.user_roles (user_id, role)
VALUES (
  'e1dce661-6dc7-4710-8ae2-4f607b53562d',
  'super_admin'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';