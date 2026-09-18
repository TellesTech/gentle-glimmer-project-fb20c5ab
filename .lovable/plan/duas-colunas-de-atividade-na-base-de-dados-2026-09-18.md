# Duas colunas de atividade na Base de Dados

## Resultado esperado
A planilha exportada passa a ter **duas colunas**:

1. **ATIVIDADE** — o nome do card/pasta, como antes (ex.: `OM 22461261 — Transportadora 09`);
2. **LOCAL** — a informação do próprio RDO que aparece hoje na coluna (ex.: `CRA PE`, `CAC`, `GE1 AF-01`, `DIGESTOR C`).

## Estado atual (confirmado no código)
- Em `src/pages/WorkforceDatabase.tsx`, os registros carregam `activity_name` com o valor do RDO (local → título da OM → nome da atividade), via `reportActivityName` e `syncFromRdos`.
- O nome do card/pasta já é calculado por `activityNameForProject(project_id)` (mesmo rótulo dos cards "Meus RDOs"), mas hoje só é usado como fallback.
- Exportação Excel (`exportExcel`, linhas 857–930) e PDF (`exportPdf`, linhas 932+) usam apenas `activity_name`.

## Alterações
1. **Registros**: ao montar cada linha (RDOs e registros manuais), guardar também `activity_group` = `activityNameForProject(project_id)` (com fallback para o próprio `activity_name` quando não houver grupo).
2. **Excel** (`exportExcel`):
   - Coluna 1 `ATIVIDADE` ← `activity_group` (nome do card, como era antes);
   - Nova coluna 2 `LOCAL` ← `activity_name` (valor do RDO);
   - Ajustar a mesclagem do título (linha de filtros) para o novo total de colunas.
3. **PDF** (`exportPdf`): adicionar a coluna `LOCAL` ao lado de `ATIVIDADE`, ajustando larguras.
4. **Tabela na tela** (Base de Dados): adicionar a coluna `LOCAL` ao lado de `ATIVIDADE`, para a tela bater com o arquivo.
5. **Aba "Atrasos no Período"**: manter como está (já usa ATIVIDADE / PROJETO).

## Verificação
- Exportar a planilha e conferir: `ATIVIDADE` com o nome do card e `LOCAL` com valores como `CRA PE`, `CAC`, `GE1 AF-01`.
- Conferir a tabela na tela com as duas colunas.
- Registros manuais: ATIVIDADE mostra o grupo do projeto; LOCAL mostra o que foi informado no registro.
