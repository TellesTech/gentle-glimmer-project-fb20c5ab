Atualizar registros existentes nas tabelas `report_activities` e `projects` onde a coluna `status` é NULL ou string vazia, definindo o valor para `'planning'` (default do enum `project_status`).

SQL:
```sql
UPDATE public.report_activities
SET status = 'planning'
WHERE status IS NULL OR status::text = '';

UPDATE public.projects
SET status = 'planning'
WHERE status IS NULL OR status::text = '';
```

Execução via tool de migration (única forma de rodar UPDATE neste ambiente).