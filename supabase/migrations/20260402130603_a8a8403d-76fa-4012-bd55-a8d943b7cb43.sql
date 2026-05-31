
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, read, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function to auto-create notifications on report events
CREATE OR REPLACE FUNCTION public.notify_on_report_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  project_name TEXT;
  report_date TEXT;
  target_user UUID;
BEGIN
  -- Get project name
  SELECT p.name INTO project_name FROM projects p WHERE p.id = NEW.project_id;
  report_date := TO_CHAR(NEW.date, 'DD/MM/YYYY');

  -- Report submitted (INSERT) — notify admins of the same company
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT ur.user_id,
           'Novo Relatório Criado',
           'RDO #' || COALESCE(NEW.rdo_number::TEXT, '?') || ' - ' || COALESCE(project_name, '') || ' (' || report_date || ')',
           'info',
           '/reports/' || NEW.id
    FROM user_roles ur
    JOIN profiles pr ON pr.id = ur.user_id
    WHERE ur.role IN ('admin', 'super_admin')
      AND ur.user_id != NEW.created_by
      AND (pr.company_id = NEW.company_id OR ur.role = 'super_admin');
    RETURN NEW;
  END IF;

  -- Report approved
  IF TG_OP = 'UPDATE' AND OLD.approved_at IS NULL AND NEW.approved_at IS NOT NULL THEN
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.created_by, 'Relatório Aprovado',
              'RDO #' || COALESCE(NEW.rdo_number::TEXT, '?') || ' - ' || COALESCE(project_name, '') || ' foi aprovado.',
              'success', '/reports/' || NEW.id);
    END IF;
  END IF;

  -- Report status changed to rejected
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'rejected' THEN
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.created_by, 'Relatório Rejeitado',
              'RDO #' || COALESCE(NEW.rdo_number::TEXT, '?') || ' - ' || COALESCE(project_name, '') || ' foi rejeitado.',
              'error', '/reports/' || NEW.id);
    END IF;
  END IF;

  -- Report sent for signature
  IF TG_OP = 'UPDATE' AND OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL THEN
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.created_by, 'Relatório Enviado para Assinatura',
              'RDO #' || COALESCE(NEW.rdo_number::TEXT, '?') || ' - ' || COALESCE(project_name, '') || ' foi enviado para assinatura.',
              'warning', '/reports/' || NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_report_change
  AFTER INSERT OR UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_report_change();
