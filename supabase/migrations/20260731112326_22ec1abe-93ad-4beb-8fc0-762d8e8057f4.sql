CREATE OR REPLACE FUNCTION public.cleanup_after_report_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.whatsapp_rdo_logs
     SET status = 'deleted',
         error_message = COALESCE(error_message, 'RDO excluído do sistema'),
         report_id = NULL
   WHERE report_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_after_report_delete ON public.reports;
CREATE TRIGGER trg_cleanup_after_report_delete
BEFORE DELETE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.cleanup_after_report_delete();