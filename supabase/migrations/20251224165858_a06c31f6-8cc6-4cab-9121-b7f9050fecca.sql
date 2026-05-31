-- Remover policy antiga
DROP POLICY IF EXISTS "Super admin pode gerenciar configurações do sistema" ON public.system_settings;

-- Criar nova policy permitindo admin e super_admin
CREATE POLICY "Admins podem gerenciar configurações do sistema"
ON public.system_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::user_role) OR has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::user_role) OR has_role(auth.uid(), 'admin'::user_role));