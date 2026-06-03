CREATE OR REPLACE FUNCTION public.notify_on_report_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  project_name TEXT;
  report_date TEXT;
  report_company_id UUID;
  author_name TEXT;
  actor_name TEXT;
BEGIN
  SELECT p.name, s.company_id
    INTO project_name, report_company_id
    FROM projects p
    JOIN sites s ON s.id = p.site_id
    WHERE p.id = NEW.project_id;

  report_date := TO_CHAR(NEW.date, 'DD/MM/YYYY');

  SELECT COALESCE(name, email, 'Usuário') INTO author_name
    FROM profiles WHERE id = NEW.created_by;
  author_name := COALESCE(author_name, 'Usuário');

  SELECT COALESCE(name, email, 'Usuário') INTO actor_name
    FROM profiles WHERE id = auth.uid();
  actor_name := COALESCE(actor_name, author_name);

  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        SELECT ur.user_id,
               'Novo Relatório Criado',
               'RDO #' || COALESCE(NEW.rdo_number::TEXT, '?') || ' - '
                 || COALESCE(project_name, '') || ' (' || report_date || ') criado por ' || author_name,
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

  IF TG_OP = 'UPDATE' AND OLD.approved_at IS NULL AND NEW.approved_at IS NOT NULL THEN
    IF NEW.created_by IS NOT NULL THEN
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
          INSERT INTO public.notifications (user_id, title, message, type, link)
          VALUES (NEW.created_by, 'Relatório Aprovado',
                  'RDO #' || COALESCE(NEW.rdo_number::TEXT, '?') || ' - ' || COALESCE(project_name, '') || ' foi aprovado por ' || actor_name || '.',
                  'success', '/reports/' || NEW.id);
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL THEN
    IF NEW.created_by IS NOT NULL THEN
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
          INSERT INTO public.notifications (user_id, title, message, type, link)
          VALUES (NEW.created_by, 'Relatório Enviado para Assinatura',
                  'RDO #' || COALESCE(NEW.rdo_number::TEXT, '?') || ' - ' || COALESCE(project_name, '') || ' foi enviado para assinatura por ' || actor_name || '.',
                  'warning', '/reports/' || NEW.id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;