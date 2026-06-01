## Problema

Na rota `/reports?company=...&site=...` o card de stats mostra **142 Atividades**, mas ao abrir a fábrica ArcelorMittal Pecém o cabinet exibe "0 relatório(s) • 0 ano(s)" e nenhuma pasta de atividade aparece — mesmo havendo RDOs cadastrados no banco para o site.

Causas em `src/components/reports/DocumentCabinet.tsx`:

1. O bloco que adiciona "atividades sem RDO" (linhas ~701-760) filtra apenas projetos **criados no mês atual**, descartando 142 atividades antigas.
2. A query de reports (`document-cabinet-reports`) provavelmente não está trazendo todos os RDOs do site (escopo/paginação/filtro). Por isso `siteFolder.totalCount` aparece 0 e nenhum ano é montado, mesmo havendo RDOs no banco.

## Investigação adicional (antes de codar)

- Rodar `supabase--read_query` para confirmar quantos `reports` existem ligados aos `projects` do site `3b9d33c6-4587-4088-b30e-a9062b05396f` e comparar com o que a query do cabinet retorna.
- Conferir a query em `DocumentCabinet.tsx` (~linha 510-557): verificar se há limite implícito do PostgREST (1000 linhas), filtro por `archived_at`, `status` ou escopo por `adminProjectIds` que esteja zerando o resultado para esse site.

## Correção

Em `src/components/reports/DocumentCabinet.tsx`:

### 1. Trazer todos os RDOs do site (não só os do mês/limite padrão)

- Garantir que a query de `reports` use o mesmo escopo de `projects` do site (via `project_id in adminProjectIds` quando `isRestrictedAdmin`, sem restrição quando super admin).
- Remover qualquer filtro por data/limite implícito. Se o total puder ultrapassar 1000 linhas, paginar com `.range()` em loop até esgotar, ou usar `count: 'exact'` + páginas, para evitar o teto padrão do PostgREST.
- Não filtrar por `status` nem por `archived_at` aqui (o agrupamento já lida com isso); manter o mesmo conjunto de campos já selecionado.

### 2. Surface de TODAS as atividades, não só as do mês atual

No `useMemo` `companyFolders`, no loop `allProjects.forEach`:

- Remover o early-return que exige `getYear(created) === currentYear && getMonth(created) === currentMonth`.
- Derivar `year`/`month` de `parseISO(p.created_at)`; quando `created_at` for nulo, cair para ano/mês atuais.
- Encontrar/criar `yearFolder` e `monthFolder` para esse `year`/`month` e inserir o projeto em `monthFolder.projects` (deduplicação já existe via `find(pf => pf.id === p.id)`).

### 3. Subtítulo da `siteFolder`

Ajustar o card da unidade (linha ~1175) para exibir também a contagem de atividades quando `totalCount === 0`:

- Calcular `nProjects` (somando `monthFolder.projects.length` dentro da `siteFolder`) no próprio `useMemo`.
- Mostrar `"{nProjects} atividade(s) • {totalCount} relatório(s)"`.

## Arquivos

- `src/components/reports/DocumentCabinet.tsx` — único arquivo alterado. Sem mudanças de schema, RLS, edge functions ou rotas.

## Validação

- Confirmar via SQL a contagem real de `reports` por `project.site_id = 3b9d33c6-...` antes e depois.
- Abrir `/reports?company=eef4efac-...&site=3b9d33c6-...` e verificar:
  - Os RDOs existentes aparecem agrupados em ano → mês → atividade.
  - As 142 atividades aparecem, mesmo as que ainda não têm RDO.
  - Fábricas com RDOs já funcionando continuam idênticas.
