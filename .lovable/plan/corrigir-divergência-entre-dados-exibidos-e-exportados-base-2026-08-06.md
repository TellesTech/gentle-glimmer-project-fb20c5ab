# Corrigir divergência entre dados exibidos e exportados (Base de Dados)

## Problema observado
Ao exportar Excel/PDF na Base de Dados, o conteúdo não corresponde ao que está filtrado na tela.

## O que a leitura do código mostra
- As exportações usam a lista `records` já carregada, então o período e a fábrica são respeitados.
- Porém a coluna **ATIVIDADE** exportada usa `projects.name` do banco (nome genérico do projeto), e não o rótulo mostrado na tela (`OM 22461261 — Transportadora 09`). Isso faz a planilha parecer "outra atividade".
- Ao selecionar uma atividade (grupo de OM), os registros de RDO são filtrados por `reportIds`, mas os registros manuais (`workforce_database`) e os atrasos manuais são filtrados por `projectIds`. Quando um mesmo projeto contém mais de uma OM, entram linhas de outras atividades na tabela e na exportação.
- O arquivo exportado não informa qual fábrica/atividade foi selecionada, dificultando conferir se o recorte está certo.

## Correções propostas
1. **Nome da atividade coerente com a tela**: usar o rótulo do grupo de OM (mesmo texto dos cards "Meus RDOs") na coluna ATIVIDADE do Excel e do PDF, com fallback para o nome do projeto quando não houver grupo.
2. **Recorte correto por atividade**: quando uma atividade estiver selecionada, restringir também os registros manuais e os atrasos ao conjunto real da atividade (relatórios/OM do grupo), evitando linhas de outras OMs do mesmo projeto.
3. **Cabeçalho de filtros no arquivo**: incluir no Excel (linha superior/aba) e no PDF a fábrica, a atividade selecionada, o período e a contagem de registros — para o arquivo bater visivelmente com a tela.
4. **Nome do arquivo**: incluir fábrica/atividade no nome do arquivo exportado.

## Detalhes técnicos
- Arquivo principal: `src/pages/WorkforceDatabase.tsx` (`loadRecords`, `loadDelays`, `exportExcel`, `exportPdf`).
- Reaproveitar `src/lib/rdoActivityGroups.ts` para mapear `report_id`/`project_id` → rótulo da atividade e montar um dicionário usado tanto na tabela quanto nas exportações.
- Sem mudanças de banco de dados.
