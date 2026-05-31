-- Create delay_reason_options
CREATE TABLE IF NOT EXISTS public.delay_reason_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('operational', 'climatic', 'amt')),
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert operational reasons
INSERT INTO public.delay_reason_options (category, label, order_index) VALUES
('operational', 'Atividade não liberada pela operação', 1),
('operational', 'Aguardando liberação de frente de trabalho', 2),
('operational', 'Interferência com outras atividades', 3),
('operational', 'Falta de acesso ao local', 4),
('operational', 'Equipamento indisponível', 5),
('operational', 'Problema de segurança do trabalho', 6),
('operational', 'Falta de energia elétrica', 7),
('operational', 'Outro motivo operacional', 99)
ON CONFLICT DO NOTHING;

-- Insert climatic reasons
INSERT INTO public.delay_reason_options (category, label, order_index) VALUES
('climatic', 'Chuva', 1),
('climatic', 'Vento forte', 2),
('climatic', 'Tempestade/Raios', 3),
('climatic', 'Neblina densa', 4),
('climatic', 'Calor excessivo', 5),
('climatic', 'Frio extremo', 6),
('climatic', 'Outro motivo climático', 99)
ON CONFLICT DO NOTHING;

-- Insert AMT (other) reasons
INSERT INTO public.delay_reason_options (category, label, order_index) VALUES
('amt', 'Aguardando material', 1),
('amt', 'Material com defeito', 2),
('amt', 'Falta de mão de obra', 3),
('amt', 'Documentação pendente', 4),
('amt', 'Problema de projeto/desenho', 5),
('amt', 'Aguardando inspeção', 6),
('amt', 'Retrabalho necessário', 7),
('amt', 'Outro motivo', 99)
ON CONFLICT DO NOTHING;

-- Add columns to reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS operational_deviation_reason TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS operational_deviation_details TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS climatic_deviation_reason TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS climatic_deviation_details TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS amt_deviation_reason TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS amt_deviation_details TEXT;

-- Add slug to sites
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS slug TEXT;

-- Add login_welcome_text to client_portal_settings
ALTER TABLE public.client_portal_settings ADD COLUMN IF NOT EXISTS login_welcome_text TEXT;

-- Grant permissions
GRANT ALL ON public.delay_reason_options TO authenticated, service_role, anon;
ALTER TABLE public.delay_reason_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read delay reasons" ON public.delay_reason_options FOR SELECT USING (true);

-- Reload schema
NOTIFY pgrst, 'reload schema';
