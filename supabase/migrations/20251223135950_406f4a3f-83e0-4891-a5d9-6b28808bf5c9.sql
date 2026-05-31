-- 1. Atualizar o default da tabela user_roles para 'admin'
ALTER TABLE public.user_roles 
ALTER COLUMN role SET DEFAULT 'admin'::user_role;

-- 2. Atualizar roles existentes que não são super_admin para admin
UPDATE public.user_roles 
SET role = 'admin' 
WHERE role NOT IN ('admin', 'super_admin');

-- 3. Atualizar o trigger handle_new_user para usar 'admin' como default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert profile for new user
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert default role for new user (admin instead of collaborator)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;