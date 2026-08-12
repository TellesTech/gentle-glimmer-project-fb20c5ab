# Corrigir horários e horas quando o colaborador está em mais de um RDO no mesmo dia

## O que está acontecendo (confirmado no banco)
Em 27/07/2026 o Allef Gomes Honorato tem duas presenças:
- OM 22461261 — TR 09: 07:00 → 17:00
- SECAGEM C: 07:00 → 19:00

Hoje a Base de Dados agrupa por **nome + dia**, junta os dois turnos numa única linha, mostra o início mais cedo e o fim mais tarde (07:00 → 19:00) e atribui tudo a uma única atividade. Por isso a planilha mostra 19:00 num RDO que termina às 17:00.

## Como vai ficar
Cálculo **por atividade**:
- Cada RDO/atividade gera sua própria linha, com o horário real daquele RDO (07:00 → 17:00 na OM 22461261 e 07:00 → 19:00 na Secagem C).
- HN, HH-75%, HH-100%, COM e ADN são calculados sobre o horário daquela atividade, e não sobre a junção do dia.
- Ao filtrar uma atividade específica, aparecem somente as linhas e horas daquela atividade.
- Turnos repetidos dentro do **mesmo** RDO continuam sendo mesclados (comportamento atual mantido, para não duplicar a mesma jornada).
- Na visão "Todas as atividades", as duas linhas aparecem separadas; o total do rodapé passa a ser a soma por atividade.

## Detalhes técnicos
- Arquivo: `src/pages/WorkforceDatabase.tsx` (funções `loadRecords` e a sincronização em ~linha 685).
- Trocar a chave de agrupamento de `nome|data` para `nome|data|report_id` (ou `nome|data|project_id` quando o relatório não existir), mantendo `mergeAndCalculateWorkHours` apenas dentro do grupo.
- `start_time`/`end_time` passam a vir do próprio grupo do RDO, e `activity_name` continua resolvido pelo `report_id` (rótulo igual ao dos cards "Meus RDOs").
- IDs de linha ficam únicos por relatório para não colidir na tabela e nas exportações (Excel/PDF já leem a lista `records`, então herdam a correção).
- Sem alterações de banco de dados.
