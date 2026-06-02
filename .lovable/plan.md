## Por que está zerado
O hook `useLoginStats` chama `supabase.rpc('get_login_stats')`, mas essa função não existe no banco — então retorna 0 e o bloco de stats fica escondido. No banco há 918 relatórios, 142 projetos e 14 unidades.

## Mudança (1 migration, sem alteração de UI)

```sql
CREATE OR REPLACE FUNCTION public.get_login_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'totalReports',        (SELECT COUNT(*) FROM public.reports),
    'totalProjects',       (SELECT COUNT(*) FROM public.projects),
    'totalCompaniesSites', (SELECT COUNT(*) FROM public.sites)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_login_stats() TO anon, authenticated;
```

## Resultado esperado no login
- Relatórios: 918+
- Atividades: 142
- Unidades: 14

Os números se atualizam automaticamente conforme o banco cresce (cache de 2 min no React Query, já configurado).
