CREATE TABLE IF NOT EXISTS public.rdo_activity_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  group_key text NOT NULL,
  custom_name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rdo_activity_names_site_key_uidx
  ON public.rdo_activity_names (site_id, group_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_activity_names TO authenticated;
GRANT ALL ON public.rdo_activity_names TO service_role;

ALTER TABLE public.rdo_activity_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity names viewable by site users"
ON public.rdo_activity_names FOR SELECT TO authenticated
USING (
  public.user_has_site_access(auth.uid(), site_id)
  OR site_id IN (SELECT public.portal_user_site_ids(auth.uid()))
);

CREATE POLICY "Activity names insertable by site users"
ON public.rdo_activity_names FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_site_access(auth.uid(), site_id)
  OR site_id IN (SELECT public.portal_user_site_ids(auth.uid()))
);

CREATE POLICY "Activity names updatable by site users"
ON public.rdo_activity_names FOR UPDATE TO authenticated
USING (
  public.user_has_site_access(auth.uid(), site_id)
  OR site_id IN (SELECT public.portal_user_site_ids(auth.uid()))
)
WITH CHECK (
  public.user_has_site_access(auth.uid(), site_id)
  OR site_id IN (SELECT public.portal_user_site_ids(auth.uid()))
);

CREATE POLICY "Activity names deletable by site users"
ON public.rdo_activity_names FOR DELETE TO authenticated
USING (
  public.user_has_site_access(auth.uid(), site_id)
  OR site_id IN (SELECT public.portal_user_site_ids(auth.uid()))
);

CREATE TRIGGER update_rdo_activity_names_updated_at
BEFORE UPDATE ON public.rdo_activity_names
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Usuários do portal podem editar RDOs das unidades a que têm acesso
CREATE POLICY "Portal users can update reports of their sites"
ON public.reports FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = reports.project_id
      AND p.site_id IN (SELECT public.portal_user_site_ids(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = reports.project_id
      AND p.site_id IN (SELECT public.portal_user_site_ids(auth.uid()))
  )
);

-- Histórico: registrar também data, local e campos de OM
CREATE OR REPLACE FUNCTION public.log_report_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_vals JSONB := '{}';
  new_vals JSONB := '{}';
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.report_history (report_id, action, action_by, details)
    VALUES (NEW.id, 'created', NEW.created_by, jsonb_build_object('status', NEW.status));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.report_history (report_id, action, action_by, details)
      VALUES (NEW.id, 'status_changed', auth.uid(),
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    END IF;

    IF OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL THEN
      INSERT INTO public.report_history (report_id, action, action_by, details)
      VALUES (NEW.id, 'sent', auth.uid(), jsonb_build_object('sent_at', NEW.sent_at));
    END IF;

    IF OLD.finalized_at IS NULL AND NEW.finalized_at IS NOT NULL THEN
      INSERT INTO public.report_history (report_id, action, action_by, details)
      VALUES (NEW.id, 'finalized', auth.uid(), NULL);
    END IF;

    IF OLD.approved_at IS NULL AND NEW.approved_at IS NOT NULL THEN
      INSERT INTO public.report_history (report_id, action, action_by, details)
      VALUES (NEW.id, 'approved', auth.uid(), NULL);
    END IF;

    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
      INSERT INTO public.report_history (report_id, action, action_by, details)
      VALUES (NEW.id, 'archived', auth.uid(), NULL);
    END IF;

    IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN
      INSERT INTO public.report_history (report_id, action, action_by, details)
      VALUES (NEW.id, 'unarchived', auth.uid(), NULL);
    END IF;

    IF OLD.comments IS DISTINCT FROM NEW.comments THEN
      old_vals := old_vals || jsonb_build_object('comments', COALESCE(OLD.comments, ''));
      new_vals := new_vals || jsonb_build_object('comments', COALESCE(NEW.comments, ''));
    END IF;
    IF OLD.location IS DISTINCT FROM NEW.location THEN
      old_vals := old_vals || jsonb_build_object('location', COALESCE(OLD.location, ''));
      new_vals := new_vals || jsonb_build_object('location', COALESCE(NEW.location, ''));
    END IF;
    IF OLD.date IS DISTINCT FROM NEW.date THEN
      old_vals := old_vals || jsonb_build_object('date', COALESCE(OLD.date::text, ''));
      new_vals := new_vals || jsonb_build_object('date', COALESCE(NEW.date::text, ''));
    END IF;
    IF OLD.maintenance_order_number IS DISTINCT FROM NEW.maintenance_order_number THEN
      old_vals := old_vals || jsonb_build_object('maintenance_order_number', COALESCE(OLD.maintenance_order_number, ''));
      new_vals := new_vals || jsonb_build_object('maintenance_order_number', COALESCE(NEW.maintenance_order_number, ''));
    END IF;
    IF OLD.maintenance_order_title IS DISTINCT FROM NEW.maintenance_order_title THEN
      old_vals := old_vals || jsonb_build_object('maintenance_order_title', COALESCE(OLD.maintenance_order_title, ''));
      new_vals := new_vals || jsonb_build_object('maintenance_order_title', COALESCE(NEW.maintenance_order_title, ''));
    END IF;

    IF old_vals != '{}' THEN
      INSERT INTO public.report_history (report_id, action, action_by, old_values, new_values)
      VALUES (NEW.id, 'updated', auth.uid(), old_vals, new_vals);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;