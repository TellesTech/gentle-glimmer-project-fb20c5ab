-- 1) Normaliza números de OM
UPDATE public.reports
SET maintenance_order_number = NULLIF(
  regexp_replace(
    split_part(
      regexp_replace(trim(maintenance_order_number), '\s+(E|e)\s+', ' / ', 'g'),
      ' / ', 1
    ),
    '^\s*(A|OM|OS|O\.M\.|O\.S\.|N[ºo°]\.?)\s+|[.\s]+$', '', 'g'
  ), '')
WHERE maintenance_order_number IS NOT NULL
  AND maintenance_order_number !~ '^[0-9A-Za-z/._-]+$' OR maintenance_order_number ~ '(^\s|\s$|\.$|^A\s|\s/\s|\sE\s)';

-- 2) Títulos inválidos / linhas de seção do modelo viram NULL
UPDATE public.reports
SET maintenance_order_title = NULL
WHERE maintenance_order_title IS NOT NULL
  AND (
    lower(trim(maintenance_order_title)) IN ('na','n/a','n.a','-','--','0','null','sem om','sem os','nao informado','não informado')
    OR maintenance_order_title ~* '^(registro de hor|atividades executadas|observa[çc]|equipe de trabalho|hor[áa]rio de trabalho|faixa de r[áa]dio|chegada|libera[çc][ãa]o|in[íi]cio|t[ée]rmino|data\b|relat[óo]rio di[áa]rio|ponto de|dds)'
  );

-- 3) Unifica o título por OM (primeiro título registrado vira o canônico)
WITH canonical AS (
  SELECT DISTINCT ON (maintenance_order_number)
         maintenance_order_number, maintenance_order_title
  FROM public.reports
  WHERE maintenance_order_number IS NOT NULL
    AND maintenance_order_title IS NOT NULL
    AND trim(maintenance_order_title) <> ''
  ORDER BY maintenance_order_number, created_at ASC
)
UPDATE public.reports r
SET maintenance_order_title = c.maintenance_order_title
FROM canonical c
WHERE r.maintenance_order_number = c.maintenance_order_number
  AND (r.maintenance_order_title IS DISTINCT FROM c.maintenance_order_title);