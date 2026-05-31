-- Create function to get project predictions and risk analysis
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
  GROUP BY p.id, p.name, p.status, p.progress, p.start_date, p.end_date, s.name, c.name
  ORDER BY 
    CASE 
      WHEN p.status = 'in_progress' AND COALESCE(EXTRACT(DAY FROM NOW() - MAX(r.date))::INT, 999) > 7 THEN 0
      WHEN p.status = 'in_progress' AND COALESCE(EXTRACT(DAY FROM NOW() - MAX(r.date))::INT, 999) > 3 THEN 1
      ELSE 2
    END,
    p.name
$$;