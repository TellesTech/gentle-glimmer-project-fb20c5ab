-- Adicionar coluna rdo_number na tabela reports
ALTER TABLE public.reports ADD COLUMN rdo_number INTEGER;

-- Criar função para calcular próximo número RDO por projeto
CREATE OR REPLACE FUNCTION public.get_next_rdo_number(p_project_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(rdo_number), 0) + 1 INTO next_number
  FROM public.reports
  WHERE project_id = p_project_id;
  
  RETURN next_number;
END;
$$;

-- Criar função trigger para atribuir número automaticamente
CREATE OR REPLACE FUNCTION public.set_rdo_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.rdo_number IS NULL THEN
    NEW.rdo_number := public.get_next_rdo_number(NEW.project_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE INSERT
CREATE TRIGGER trigger_set_rdo_number
BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.set_rdo_number();

-- Migrar dados existentes: calcular sequência retroativa por projeto baseado em created_at
WITH numbered_reports AS (
  SELECT id, project_id, created_at,
         ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at ASC) as seq
  FROM public.reports
)
UPDATE public.reports r
SET rdo_number = nr.seq::INTEGER
FROM numbered_reports nr
WHERE r.id = nr.id;