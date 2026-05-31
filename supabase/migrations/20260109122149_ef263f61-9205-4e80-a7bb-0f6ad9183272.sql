-- Criar tabela de histórico de relatórios
CREATE TABLE public.report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  action_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  details JSONB,
  old_values JSONB,
  new_values JSONB
);

-- Índice para busca rápida por relatório
CREATE INDEX idx_report_history_report_id ON public.report_history(report_id);
CREATE INDEX idx_report_history_action_at ON public.report_history(action_at DESC);

-- Habilitar RLS
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;

-- Política de leitura (segue a mesma lógica da tabela reports)
CREATE POLICY "Users can view report history" ON public.report_history
FOR SELECT USING (
  report_id IN (SELECT id FROM public.reports)
);

-- Política de inserção (usuários autenticados)
CREATE POLICY "Authenticated users can insert history" ON public.report_history
FOR INSERT TO authenticated WITH CHECK (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_history;

-- Função para registrar mudanças automaticamente
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
    
    -- Detectar edição de campos importantes (quando não é mudança de status/envio/arquivo)
    IF OLD.updated_at IS DISTINCT FROM NEW.updated_at 
       AND OLD.status IS NOT DISTINCT FROM NEW.status 
       AND OLD.sent_at IS NOT DISTINCT FROM NEW.sent_at
       AND OLD.archived_at IS NOT DISTINCT FROM NEW.archived_at
       AND OLD.finalized_at IS NOT DISTINCT FROM NEW.finalized_at
       AND OLD.approved_at IS NOT DISTINCT FROM NEW.approved_at THEN
      
      -- Capturar campos alterados
      IF OLD.comments IS DISTINCT FROM NEW.comments THEN
        old_vals := old_vals || jsonb_build_object('comments', COALESCE(OLD.comments, ''));
        new_vals := new_vals || jsonb_build_object('comments', COALESCE(NEW.comments, ''));
      END IF;
      IF OLD.location IS DISTINCT FROM NEW.location THEN
        old_vals := old_vals || jsonb_build_object('location', COALESCE(OLD.location, ''));
        new_vals := new_vals || jsonb_build_object('location', COALESCE(NEW.location, ''));
      END IF;
      IF OLD.shift IS DISTINCT FROM NEW.shift THEN
        old_vals := old_vals || jsonb_build_object('shift', OLD.shift);
        new_vals := new_vals || jsonb_build_object('shift', NEW.shift);
      END IF;
      IF OLD.weather IS DISTINCT FROM NEW.weather THEN
        old_vals := old_vals || jsonb_build_object('weather', OLD.weather);
        new_vals := new_vals || jsonb_build_object('weather', NEW.weather);
      END IF;
      IF OLD.date IS DISTINCT FROM NEW.date THEN
        old_vals := old_vals || jsonb_build_object('date', OLD.date);
        new_vals := new_vals || jsonb_build_object('date', NEW.date);
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

-- Criar trigger
CREATE TRIGGER report_changes_trigger
  AFTER INSERT OR UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.log_report_changes();

-- Migrar dados existentes: criar entrada de histórico "created" para RDOs existentes
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