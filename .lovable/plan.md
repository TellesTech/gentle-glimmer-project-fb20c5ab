# Padronizar as pastas de atividade do portal do cliente com a área WEES

## Problema (confirmado no código)
Na área WEES ("Meus RDOs"), as pastas de atividade são montadas por `buildActivityGroups` (`src/lib/rdoActivityGroups.ts`): agrupa por número de OM, depois por título da OM, funde títulos semelhantes e nomeia como `OM <número> — <título>`.

No portal do cliente (`src/pages/client/ClientDashboard.tsx`, linhas 511-563) as pastas são montadas por **projeto** (`project.id` / `project.name`). Como a IA do WhatsApp cria projetos com nomes variados, o cliente vê pastas duplicadas, com nomes errados ou "que não existem" na visão WEES.

A tela seguinte (`src/pages/client/ClientActivityList.tsx`) também busca os RDOs por `project_id`, então depende do mesmo agrupamento.

## Correção
1. **Mesmo agrupamento**: no `ClientDashboard`, passar a buscar dos RDOs também `location`, `maintenance_order_number` e `maintenance_order_title` e montar as pastas de atividade do mês com `buildActivityGroups`, exatamente como a área WEES. Nome da pasta = nome do grupo (`OM 22461261 — Transportadora 09`, etc.).
2. **Mesmos filtros/contagens**: manter o escopo atual do portal (apenas RDOs `sent`/`signed`/`finalized`, meses ocultos respeitados) e recalcular total / pendentes / assinados por grupo, não por projeto.
3. **Navegação**: o clique na pasta passa a abrir a atividade pelo id do grupo (OM/título) em vez do id do projeto. `ClientActivityList` passa a resolver os RDOs pelo mesmo agrupamento (todos os projetos/relatórios do grupo), mantendo as regras de visibilidade atuais, e o cabeçalho mostra o nome padronizado do grupo.
4. **Downloads em ZIP** do mês continuam funcionando, usando o nome padronizado da atividade como nome da subpasta.

## Detalhes técnicos
- `src/pages/client/ClientDashboard.tsx`: incluir os campos de OM nos dois `select` de reports (visão admin e visão cliente); em `monthFolders`, chamar `buildActivityGroups` por mês e derivar `total/pending/signed/lastDate/reports` de `group.reportIds`.
- `src/pages/client/ClientActivityList.tsx`: aceitar o id de grupo (`om:...` / `title:...` / `project:...`), reconstruir os grupos do escopo do usuário e filtrar pelos `reportIds` correspondentes; fallback para o comportamento atual quando o parâmetro for um UUID de projeto (links antigos).
- Sem alterações de banco de dados, RLS ou de layout visual das pastas.

## Fora do escopo
- Mudar quais RDOs o cliente pode ver (regras de visibilidade permanecem iguais).
