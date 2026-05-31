-- Tabela para controle de notificações de alertas IA
CREATE TABLE public.ai_alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('critical', 'high_risk', 'delayed_start')),
  notification_method TEXT DEFAULT 'in_app' CHECK (notification_method IN ('email', 'in_app')),
  notified_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para evitar notificações duplicadas no mesmo dia
CREATE INDEX idx_ai_alert_notifications_lookup 
  ON public.ai_alert_notifications(user_id, project_id, alert_type, notified_at);

-- RLS
ALTER TABLE public.ai_alert_notifications ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver suas próprias notificações
CREATE POLICY "Users can view their own alert notifications"
  ON public.ai_alert_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: sistema pode inserir notificações (via service role)
CREATE POLICY "Service role can manage all notifications"
  ON public.ai_alert_notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);