-- 1. Renumerar todos os RDOs existentes para eliminar duplicados garantindo uma sequência única por projeto
WITH ranked_reports AS (
  SELECT 
    id, 
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at ASC, id ASC) as new_seq
  FROM public.reports
)
UPDATE public.reports r
SET rdo_number = rr.new_seq
FROM ranked_reports rr
WHERE r.id = rr.id;

-- 2. Adicionar constraint UNIQUE para impedir futuras duplicatas por projeto
-- Se houver erro aqui, é sinal de que a query acima falhou em limpar algum caso (improvável com ROW_NUMBER)
ALTER TABLE public.reports 
ADD CONSTRAINT reports_project_rdo_unique UNIQUE (project_id, rdo_number);

-- 3. Melhorar a função de geração de número com lock consultivo de transação
-- Isso evita que dois processos calculando simultaneamente peguem o mesmo MAX+1
CREATE OR REPLACE FUNCTION public.get_next_rdo_number(p_project_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  -- Lock string determinística para o projeto
  lock_key BIGINT;
BEGIN
  -- Gerar uma chave numérica para o lock baseada no ID do projeto
  lock_key := ('x' || substr(md5(p_project_id::text), 1, 15))::bit(60)::bigint;
  
  -- Adquirir lock para este projeto específico até o fim da transação
  PERFORM pg_advisory_xact_lock(lock_key);

  SELECT COALESCE(MAX(rdo_number), 0) + 1 INTO next_number
  FROM public.reports
  WHERE project_id = p_project_id;
  
  RETURN next_number;
END;
$$;

-- 4. Ajustar o trigger para lidar com inserts manuais (evitando erros de UNIQUE)
CREATE OR REPLACE FUNCTION public.set_rdo_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se for nulo ou se já existir no banco (para evitar erro de UNIQUE constraint)
  IF NEW.rdo_number IS NULL OR EXISTS (
    SELECT 1 FROM public.reports 
    WHERE project_id = NEW.project_id AND rdo_number = NEW.rdo_number
  ) THEN
    NEW.rdo_number := public.get_next_rdo_number(NEW.project_id);
  END IF;
  RETURN NEW;
END;
$$;
