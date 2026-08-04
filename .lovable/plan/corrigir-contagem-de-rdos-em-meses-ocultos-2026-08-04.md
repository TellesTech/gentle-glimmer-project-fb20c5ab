# Corrigir contagem de RDOs em meses ocultos

## Problema (confirmado)
As pastas de mês e as métricas usam numerações de mês diferentes:

- As pastas gravam o mês em base 0 (Janeiro = 0, Fevereiro = 1). No banco, `portal_hidden_months` tem hoje os registros `2026/0` e `2026/1` — Janeiro e Fevereiro de Suzano Aracruz.
- O cálculo das métricas (`RDOS`, `ASSINADOS`, `PENDENTES`) converte a data do relatório para base 1 (Janeiro = 1, Fevereiro = 2).

Resultado: os RDOs de Janeiro batem por acidente com a chave "1" (que na verdade é Fevereiro) e são removidos, e os de Fevereiro (chave "2") não batem com nada e continuam contando. Por isso a visão do cliente mostra 2 RDOs / 2 assinados mesmo sem nenhuma pasta visível.

## Correção
1. Padronizar a chave de mês oculto em base 0 em todos os pontos do dashboard (pastas, métricas, gráficos e lista de pendentes), usando um único helper de chave para não haver divergência futura.
2. Verificar os demais lugares que consultam `portal_hidden_months` (portal do cliente e lista de atividades) e alinhá-los à mesma convenção.
3. Conferir na visão simulada de cliente que, com Janeiro e Fevereiro ocultos, as três métricas ficam zeradas e nenhuma pasta aparece; e que na visão WEES os totais completos continuam sendo exibidos com as pastas esmaecidas.

## Detalhes técnicos
- `src/pages/client/ClientDashboard.tsx`: trocar `d.getMonth() + 1` por `getMonth(d)` no filtro `visibleReports` e em qualquer outro cálculo derivado; centralizar em `hiddenKey(year, monthIndex)`.
- Revisar `src/pages/client/ClientActivityList.tsx` e demais consumidores de `portal_hidden_months` para a mesma base.
- Sem alteração de banco: os registros existentes já estão em base 0 e continuam válidos.
