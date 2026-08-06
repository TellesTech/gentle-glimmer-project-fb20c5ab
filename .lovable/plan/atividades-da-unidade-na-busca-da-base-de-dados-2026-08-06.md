# Atividades da unidade na busca da Base de Dados

O filtro de "Atividade / Projeto" da Base de Dados lista linhas da tabela `projects`. Os cards de "Meus RDOs" **não** são projetos: eles são grupos montados a partir dos relatórios, agrupados por número de OM (ou por título de OM, quando não há número), com fusão de títulos parecidos. Por isso nomes como "OM 22461261 — Transportadora 09" existem em Meus RDOs e não aparecem na busca.

Além disso, hoje a Base de Dados monta o nome usando `maintenance_order_title` no lugar do número da OM (`OM {título}`), o que produz rótulos diferentes dos cards.

## O que será feito

1. Extrair a lógica de agrupamento dos cards de RDO (hoje dentro da tela Meus RDOs) para um módulo compartilhado, sem mudar o comportamento daquela tela.
2. Na Base de Dados, montar a lista de atividades a partir dos RDOs da unidade selecionada usando exatamente esse agrupamento — mesmos nomes, mesmo número de OM, mesma fusão de títulos.
3. Ao escolher uma atividade no filtro, filtrar os dados de HH pelos RDOs daquele grupo (um grupo pode abranger mais de um projeto).
4. Manter a busca por número de OM, título, localização, fábrica e empresa, sem acento e sem diferenciar maiúsculas.
5. Quando uma unidade estiver selecionada, listar somente as atividades com RDOs daquela unidade.

## Detalhes técnicos

- Novo `src/lib/rdoActivityGroups.ts` com `normalizeOmKeyNumber`, `normalizeOmTitle`, `omTitleTokens`, `tokenSimilarity` e `buildActivityGroups(reports)` — movidos de `src/components/reports/DocumentCabinet.tsx`, que passa a importar do módulo.
- `src/pages/WorkforceDatabase.tsx`:
  - `loadProjects`/`loadRecords` deixam de derivar nomes de `projects` e passam a buscar `reports` (id, date, location, maintenance_order_number, maintenance_order_title, project_id, projects(site_id, sites(name, companies(name)))) para a unidade selecionada e aplicar `buildActivityGroups`.
  - Cada item do Combobox vira um grupo com `key`, `name` (`OM {número} — {título}`), `reportIds`, `projectIds` e `searchString`.
  - `selectedProject` passa a guardar a chave do grupo; os filtros de `report_attendance` usam `report_id in reportIds` e os registros manuais de `workforce_database` usam `project_id in projectIds`.
  - Filtro do `Command` continua case/acento-insensível sobre `searchString`.

## Verificação

- Selecionar "Suzano Aracruz" e conferir que "OM 22461261 — Transportadora 09", "OM 4502395884 — Desplacamento de concreto" e demais cards de Meus RDOs aparecem na busca.
- Buscar "Transportadora" e "22461261" e obter o mesmo item.
- Selecionar uma atividade e conferir que o HH exibido corresponde aos RDOs daquele card.
