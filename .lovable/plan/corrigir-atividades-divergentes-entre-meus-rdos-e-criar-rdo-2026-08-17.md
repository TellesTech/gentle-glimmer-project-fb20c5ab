# Corrigir atividades divergentes entre "Meus RDOs" e "Criar RDO"

## Problema (confirmado nos dados)

Em Agosto/2026 existem RDOs com:

- `P/CE.AR.IN.24030.SME` — título "CAC" (5 RDOs)
- `24030` — título "DESMI" (4 RDOs)

Em **Meus RDOs** eles aparecem como dois cards distintos (CAC e DESMI), porque o agrupamento oficial (`src/lib/rdoActivityGroups.ts`) preserva o número da OM como texto.

No **Passo 3 de Criar RDO** (`ProjectSelector.tsx`) existe uma segunda lógica de agrupamento, própria e duplicada, que reduz a OM apenas aos dígitos (`P/CE.AR.IN.24030.SME` vira `24030`). Resultado: os dois cards são fundidos em um só, e o nome exibido é o do título mais frequente ("CAC"), fazendo a atividade **DESMI desaparecer** da criação de RDO.

Essa mesma tela também ignora os nomes personalizados de pasta (renomeações salvas em `rdo_activity_names`), então cards renomeados aparecem com nome diferente dos dois lados.

## Solução

Eliminar a lógica duplicada e usar o mesmo motor de agrupamento nas duas telas.

1. Em `ProjectSelector.tsx`, substituir o bloco local de agrupamento (`monthScopedProjects` / `normOm`) por `buildActivityGroups` de `src/lib/rdoActivityGroups.ts`.
2. Carregar os nomes personalizados de atividade da unidade (`rdo_activity_names`) e passá-los para `buildActivityGroups`, igual à tela Meus RDOs.
3. Mapear cada grupo para o card do passo 3 mantendo o que a tela já usa hoje: projeto representativo (o com mais RDOs no grupo), contagem de RDOs, efetivo, progresso e última data.
4. Continuar exibindo atividades sem RDOs no mês (criadas recentemente), como já acontece.
5. Manter a propagação de `omNumber` / `omTitle` ao selecionar o card, para o novo RDO já nascer com a OM correta.

## Resultado esperado

- "OM 24030 — DESMI" e "OM P/CE.AR.IN.24030.SME — CAC" aparecem como dois cards separados no Passo 3, exatamente como em Meus RDOs.
- Nomes renomeados ficam iguais nas duas telas.
- Criar RDO dentro de um card usa a atividade correta.

## Detalhes técnicos

- Fonte única de verdade: `buildActivityGroups(reports, customNames)`.
- A query `reports-for-folders` passa a trazer também os campos usados pelo agrupamento (localização, nome do projeto, site) para gerar o mesmo nome e a mesma string de busca.
- O texto de estado vazio da busca volta ao padrão ("Nenhuma atividade encontrada"), já que o texto atual é um lembrete deste bug.

## Verificação

- Abrir Criar RDO > Suzano Aracruz > Agosto 2026 e confirmar os dois cards (CAC e DESMI) com as contagens corretas.
- Buscar "desmi" e "24030" no campo de busca do Passo 3.