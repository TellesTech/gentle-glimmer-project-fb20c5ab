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
BEGIN
  SELECT p.name, s.company_id
    INTO project_name, report_company_id
    FROM projects p
    JOIN sites s ON s.id = p.site_id
   WHERE p.id = NEW.project_id;

  report_date := TO_CHAR(NEW.date, 'DD/MM/YYYY');

  -- INSERT: notificar admins
  IF TG_OP = 'INSERT' THEN
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
    RETURN NEW;
  END IF;

  -- Aprovação
  IF TG_OP = 'UPDATE' AND OLD.approved_at IS NULL AND NEW.approved_at IS NOT NULL THEN
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.created_by, 'Relatório Aprovado',
              'RDO #' || COALESCE(NEW.rdo_number::TEXT, '?') || ' - ' || COALESCE(project_name, '') || ' foi aprovado.',
              'success', '/reports/' || NEW.id);
    END IF;
  END IF;

  -- BLOCO "rejected" REMOVIDO (enum report_status não suporta esse valor)

  -- Envio para assinatura
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
$function$;