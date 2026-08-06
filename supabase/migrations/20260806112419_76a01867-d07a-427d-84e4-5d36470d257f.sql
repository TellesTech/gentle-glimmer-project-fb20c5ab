-- 1. Create report_history table if it somehow vanished
CREATE TABLE IF NOT EXISTS public.report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  action_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  details JSONB,
  old_values JSONB,
  new_values JSONB
);

-- 2. Ensure indexes
CREATE INDEX IF NOT EXISTS idx_report_history_report_id ON public.report_history(report_id);
CREATE INDEX IF NOT EXISTS idx_report_history_action_at ON public.report_history(action_at DESC);

-- 3. Grants
GRANT SELECT, INSERT ON public.report_history TO authenticated;
GRANT SELECT ON public.report_history TO anon;
GRANT ALL ON public.report_history TO service_role;

-- 4. RLS
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view report history for their reports" ON public.report_history;
CREATE POLICY "Users can view report history for their reports"
  ON public.report_history
  FOR SELECT
  TO authenticated
  USING (
    report_id IN (
      SELECT r.id FROM reports r
      JOIN projects p ON p.id = r.project_id
      WHERE p.company_id = get_user_company_id(auth.uid())
    )
    OR has_role(auth.uid(), 'super_admin'::user_role)
    OR has_role(auth.uid(), 'admin'::user_role)
  );

DROP POLICY IF EXISTS "Authenticated users can insert history" ON public.report_history;
CREATE POLICY "Authenticated users can insert history" ON public.report_history
FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Trigger Function
CREATE OR REPLACE FUNCTION public.log_report_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_vals JSONB := '{}';
  new_vals JSONB := '{}';
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.report_history (report_id, action, action_by, details)
    VALUES (NEW.id, 'created', NEW.created_by, jsonb_build_object('status', NEW.status));
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detectar mudança de status
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.report_history (report_id, action, action_by, details)
      VALUES (NEW.id, 'status_changed', auth.uid(), 
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    END IF;
    
    -- Detectar envio para assinatura
    IF OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL THEN
      INSERT INTO public.report_history (report_id, action, action_by, details)
      VALUES (NEW.id, 'sent', auth.uid(), jsonb_build_object('sent_at', NEW.sent_at));
    END IF;
    
    -- Detectar finalização
    IF OLD.finalized_at IS NULL AND NEW.finalized_at IS NOT NULL THEN
      INSERT INTO public.report_history (report_id, action, action_by, details)
      VALUES (NEW.id, 'finalized', auth.uid(), NULL);
    END IF;
    
    -- Detectar aprovação
    IF OLD.approved_at IS NULL AND NEW.approved_at IS NOT NULL THEN
      INSERT INTO public.report_history (report_id, action, action_by, details)
      VALUES (NEW.id, 'approved', auth.uid(), NULL);
    END IF;
    
    -- Detectar arquivamento
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
      INSERT INTO public.report_history (report_id, action, action_by, details)
      VALUES (NEW.id, 'archived', auth.uid(), NULL);
    END IF;
    
    -- Detectar desarquivamento
    IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN
      INSERT INTO public.report_history (report_id, action, action_by, details)
      VALUES (NEW.id, 'unarchived', auth.uid(), NULL);
    END IF;
    
    -- Detectar edição de campos importantes
    IF OLD.updated_at IS DISTINCT FROM NEW.updated_at 
       AND OLD.status IS NOT DISTINCT FROM NEW.status 
       AND OLD.sent_at IS NOT DISTINCT FROM NEW.sent_at
       AND OLD.archived_at IS NOT DISTINCT FROM NEW.archived_at
       AND OLD.finalized_at IS NOT DISTINCT FROM NEW.finalized_at
       AND OLD.approved_at IS NOT DISTINCT FROM NEW.approved_at THEN
      
      IF OLD.comments IS DISTINCT FROM NEW.comments THEN
        old_vals := old_vals || jsonb_build_object('comments', COALESCE(OLD.comments, ''));
        new_vals := new_vals || jsonb_build_object('comments', COALESCE(NEW.comments, ''));
      END IF;
      IF OLD.location IS DISTINCT FROM NEW.location THEN
        old_vals := old_vals || jsonb_build_object('location', COALESCE(OLD.location, ''));
        new_vals := new_vals || jsonb_build_object('location', COALESCE(NEW.location, ''));
      END IF;
      
      IF old_vals != '{}' THEN
        INSERT INTO public.report_history (report_id, action, action_by, old_values, new_values)
        VALUES (NEW.id, 'updated', auth.uid(), old_vals, new_vals);
      END IF;
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 6. Trigger
DROP TRIGGER IF EXISTS report_changes_trigger ON public.reports;
CREATE TRIGGER report_changes_trigger
  AFTER INSERT OR UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.log_report_changes();

-- 7. Sync existing
INSERT INTO public.report_history (report_id, action, action_by, action_at, details)
SELECT 
  id, 
  'created', 
  created_by, 
  created_at,
  jsonb_build_object('status', status, 'migrated', true)
FROM public.reports
WHERE NOT EXISTS (
  SELECT 1 FROM public.report_history h 
  WHERE h.report_id = reports.id AND h.action = 'created'
);
