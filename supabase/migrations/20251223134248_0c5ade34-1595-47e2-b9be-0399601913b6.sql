-- Tabela para configurações públicas do sistema (acessíveis antes do login)
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text,
  favicon_url text,
  system_name text DEFAULT 'Sistema RDO',
  system_subtitle text DEFAULT 'Gestão de Obras',
  primary_color text DEFAULT '#7A1B3E',
  accent_color text DEFAULT '#f59e0b',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO public.system_settings (system_name, system_subtitle) 
VALUES ('Sistema RDO', 'Gestão de Obras');

-- Habilitar RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Permitir leitura pública (antes do login)
CREATE POLICY "Leitura pública das configurações do sistema"
ON public.system_settings
FOR SELECT
USING (true);

-- Apenas super_admin pode gerenciar
CREATE POLICY "Super admin pode gerenciar configurações do sistema"
ON public.system_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::user_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();