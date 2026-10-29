CREATE OR REPLACE FUNCTION public.route_report_to_existing_om_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_digits text;
  v_site uuid;
  v_target uuid;
BEGIN
  v_digits := regexp_replace(coalesce(NEW.maintenance_order_number,''), '\D', '', 'g');
  IF length(v_digits) < 5 OR NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT site_id INTO v_site FROM projects WHERE id = NEW.project_id;
  IF v_site IS NULL THEN RETURN NEW; END IF;

  SELECT r.project_id INTO v_target
  FROM reports r JOIN projects p ON p.id = r.project_id
  WHERE p.site_id = v_site
    AND regexp_replace(coalesce(r.maintenance_order_number,''), '\D', '', 'g') = v_digits
    AND r.id <> NEW.id
  GROUP BY r.project_id
  ORDER BY count(*) DESC, min(r.created_at) ASC
  LIMIT 1;

  IF v_target IS NOT NULL AND v_target <> NEW.project_id THEN
    NEW.project_id := v_target;
    UPDATE projects SET status = 'in_progress'
      WHERE id = v_target AND status IN ('completed','suspended');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_report_om ON public.reports;
CREATE TRIGGER trg_route_report_om
BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.route_report_to_existing_om_project();