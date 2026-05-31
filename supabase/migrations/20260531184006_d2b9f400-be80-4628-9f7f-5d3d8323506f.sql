-- Add missing columns to reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS operational_deviation_details TEXT;

-- Create delay_type enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delay_type') THEN
        CREATE TYPE public.delay_type AS ENUM ('clima', 'material', 'equipamento', 'mao_de_obra', 'logistica', 'outro');
    END IF;
END $$;

-- Create workforce_database
CREATE TABLE IF NOT EXISTS public.workforce_database (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES public.report_attendance(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  date DATE NOT NULL,
  worker_name TEXT NOT NULL,
  function_role TEXT,
  start_time TEXT,
  end_time TEXT,
  normal_hours NUMERIC(5,2) DEFAULT 0,
  compensation_hours NUMERIC(5,2) DEFAULT 0,
  overtime_75 NUMERIC(5,2) DEFAULT 0,
  overtime_100 NUMERIC(5,2) DEFAULT 0,
  night_bonus NUMERIC(5,2) DEFAULT 0,
  processed_by_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create workforce_delays
CREATE TABLE IF NOT EXISTS public.workforce_delays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  activity_name TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  delay_type public.delay_type NOT NULL DEFAULT 'outro',
  delay_hours NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client_portal_settings
CREATE TABLE IF NOT EXISTS public.client_portal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  welcome_title text DEFAULT 'Bem-vindo ao Portal',
  welcome_subtitle text DEFAULT 'Acompanhe seus relatórios e aprovações',
  client_logo_url text,
  client_primary_color text DEFAULT '#991919',
  client_accent_color text DEFAULT '#1e1e1e',
  show_stats_cards boolean DEFAULT true,
  show_approval_rate boolean DEFAULT true,
  show_rejection_stats boolean DEFAULT true,
  show_autentique_widget boolean DEFAULT true,
  show_supersign_alert boolean DEFAULT true,
  show_project_filter boolean DEFAULT true,
  dashboard_title text DEFAULT 'Dashboard',
  reports_title text DEFAULT 'Relatórios',
  signatures_title text DEFAULT 'Assinaturas',
  profile_title text DEFAULT 'Meu Perfil',
  pending_message text DEFAULT '{count} relatório(s) aguardando aprovação.',
  all_clear_message text DEFAULT 'Todos os relatórios estão em dia.',
  no_signature_alert_title text DEFAULT 'Assinatura WEES não configurada',
  no_signature_alert_message text DEFAULT 'Configure sua assinatura digital para aprovar relatórios.',
  support_email text,
  support_phone text,
  footer_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS and grant permissions
ALTER TABLE public.workforce_database ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_delays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_settings ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.workforce_database TO authenticated, service_role, anon;
GRANT ALL ON public.workforce_delays TO authenticated, service_role, anon;
GRANT ALL ON public.client_portal_settings TO authenticated, service_role, anon;

-- Policies
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can manage workforce data' AND tablename = 'workforce_database') THEN
    CREATE POLICY "Anyone can manage workforce data" ON public.workforce_database FOR ALL USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can manage workforce delays' AND tablename = 'workforce_delays') THEN
    CREATE POLICY "Anyone can manage workforce delays" ON public.workforce_delays FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can manage portal settings' AND tablename = 'client_portal_settings') THEN
    CREATE POLICY "Anyone can manage portal settings" ON public.client_portal_settings FOR ALL USING (true);
  END IF;
END $$;

-- Predictions RPC
CREATE OR REPLACE FUNCTION public.get_project_predictions()
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  site_name TEXT,
  company_name TEXT,
  status TEXT,
  progress INT,
  days_since_last_report INT,
  avg_daily_progress NUMERIC,
  total_reports INT,
  predicted_completion_days INT,
  risk_level TEXT,
  days_until_deadline INT,
  start_date DATE,
  end_date DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id as project_id,
    p.name as project_name,
    s.name as site_name,
    c.name as company_name,
    p.status::TEXT,
    COALESCE(p.progress, 0)::INT as progress,
    COALESCE(EXTRACT(DAY FROM NOW() - MAX(r.date))::INT, 999) as days_since_last_report,
    COALESCE(ROUND(AVG(r.daily_progress)::NUMERIC, 2), 0) as avg_daily_progress,
    COUNT(r.id)::INT as total_reports,
    CASE 
      WHEN AVG(r.daily_progress) > 0 AND COALESCE(p.progress, 0) < 100 THEN 
        CEIL((100 - COALESCE(p.progress, 0)) / NULLIF(AVG(r.daily_progress), 0))::INT
      ELSE NULL
    END as predicted_completion_days,
    CASE
      WHEN p.status = 'completed' THEN 'concluído'
      WHEN p.status = 'suspended' THEN 'pausado'
      WHEN COALESCE(EXTRACT(DAY FROM NOW() - MAX(r.date))::INT, 999) > 7 AND p.status = 'in_progress' THEN 'crítico'
      WHEN COALESCE(EXTRACT(DAY FROM NOW() - MAX(r.date))::INT, 999) > 3 AND p.status = 'in_progress' THEN 'alto'
      WHEN COALESCE(AVG(r.daily_progress), 0) < 2 AND COALESCE(p.progress, 0) < 50 AND p.status = 'in_progress' THEN 'médio'
      WHEN p.status = 'planning' AND p.start_date IS NOT NULL AND p.start_date < CURRENT_DATE THEN 'atrasado_inicio'
      ELSE 'baixo'
    END as risk_level,
    CASE 
      WHEN p.end_date IS NOT NULL THEN 
        EXTRACT(DAY FROM p.end_date - NOW())::INT
      ELSE NULL
    END as days_until_deadline,
    p.start_date,
    p.end_date
  FROM projects p
  LEFT JOIN sites s ON s.id = p.site_id
  LEFT JOIN companies c ON c.id = s.company_id
  LEFT JOIN reports r ON r.project_id = p.id
  WHERE p.status IN ('in_progress', 'planning', 'suspended')
  GROUP BY p.id, p.name, p.status, p.progress, p.start_date, p.end_date, s.name, c.name;
$$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
