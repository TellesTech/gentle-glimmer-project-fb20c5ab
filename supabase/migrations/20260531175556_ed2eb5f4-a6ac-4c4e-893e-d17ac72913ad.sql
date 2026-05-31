-- Fix missing columns in reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS rdo_number INTEGER;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS no_activity BOOLEAN DEFAULT false;

-- Fix missing column in profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_data TEXT;

-- Recreate notifications table if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
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

        CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read, created_at DESC);
    END IF;
END $$;

-- Grant permissions to ALL tables in public schema
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant permissions on ALL sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant execution on ALL functions
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Ensure triggers can access everything
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- Update the notification trigger to ensure it works correctly
CREATE OR REPLACE FUNCTION public.notify_on_report_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  project_name TEXT;
  report_date TEXT;
  report_company_id UUID;
BEGIN
  -- Resolve company_id via project → site chain
  SELECT p.name, s.company_id
    INTO project_name, report_company_id
    FROM projects p
    JOIN sites s ON s.id = p.site_id
    WHERE p.id = NEW.project_id;

  report_date := TO_CHAR(NEW.date, 'DD/MM/YYYY');

  -- INSERT: notificar admins
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        SELECT ur.user_id,
               'Novo Relatório Criado',
               'RDO #' || COALESCE(NEW.rdo_number::TEXT, '?') || ' - '
                 || COALESCE(project_name, '') || ' (' || report_date || ')',
               'info',
               '/reports/' || NEW.id
          FROM user_roles ur
          JOIN profiles pr ON pr.id = ur.user_id
         WHERE ur.role IN ('admin', 'super_admin')
           AND ur.user_id != NEW.created_by
           AND (pr.company_id = report_company_id OR ur.role = 'super_admin');
    END IF;
    RETURN NEW;
  END IF;

  -- Aprovação
  IF TG_OP = 'UPDATE' AND OLD.approved_at IS NULL AND NEW.approved_at IS NOT NULL THEN
    IF NEW.created_by IS NOT NULL THEN
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
          INSERT INTO public.notifications (user_id, title, message, type, link)
          VALUES (NEW.created_by, 'Relatório Aprovado',
                  'RDO #' || COALESCE(NEW.rdo_number::TEXT, '?') || ' - ' || COALESCE(project_name, '') || ' foi aprovado.',
                  'success', '/reports/' || NEW.id);
      END IF;
    END IF;
  END IF;

  -- Envio para assinatura
  IF TG_OP = 'UPDATE' AND OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL THEN
    IF NEW.created_by IS NOT NULL THEN
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
          INSERT INTO public.notifications (user_id, title, message, type, link)
          VALUES (NEW.created_by, 'Relatório Enviado para Assinatura',
                  'RDO #' || COALESCE(NEW.rdo_number::TEXT, '?') || ' - ' || COALESCE(project_name, '') || ' foi enviado para assinatura.',
                  'warning', '/reports/' || NEW.id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure triggers are attached
DROP TRIGGER IF EXISTS trg_notify_on_report_change ON public.reports;
CREATE TRIGGER trg_notify_on_report_change
  AFTER INSERT OR UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_report_change();

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
