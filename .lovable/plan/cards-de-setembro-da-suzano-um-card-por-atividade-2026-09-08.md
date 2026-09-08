# Cards de setembro da Suzano: um card por atividade

## O que está acontecendo (verificado nos dados)

Na unidade Suzano Aracruz, em setembro, existem apenas 12 RDOs, e quase todos já estão na atividade **housekeeping** (10 RDOs). Mesmo assim aparecem 6 cards, porque a tela "Meus RDOs" cria um card por **número/título de OM**, e não por atividade:

- OM 24030 — Tratamento e pintura
- OM 24030 — Remoção de viga e bandejamento
- OM 22035936 — Recuperar plataforma do PE 290
- OM 22860337 — Substituição de telhas
- Emergência - Remoção de material com risco de queda
- Substituição de telhas (Nano)

Além disso, a troca de telhas está espalhada em **três atividades diferentes**:

- `TELHADO - NANO CELULOSE` (1 RDO)
- `EMERGÊNCIAL - TROCA DE TELHAS` (1 RDO, criada pelo WhatsApp em 08/09)
- 1 RDO de telhas da Nano gravado dentro de `housekeeping`

## O que será feito

### 1. Card = atividade (não mais OM)

O agrupamento passa a ser pela atividade do RDO. Cada card mostra o nome da atividade, e as OMs do mês aparecem **dentro do card** (lista de OMs no detalhe, e um resumo do tipo "3 OMs" no card). Resultado em setembro: **housekeeping** e **troca de telhas da Nano**.

Isso vale para as três telas que hoje montam cards: Meus RDOs, portal do cliente e o passo de escolha de atividade ao criar RDO — todas usam o mesmo motor de agrupamento, então ficam iguais.

Os nomes personalizados de pasta (renomear) continuam funcionando, agora ligados à atividade.

### 2. Unificar as telhas em uma atividade

- Mover o RDO de telhas da Nano que está em `housekeeping` para `TELHADO - NANO CELULOSE`.
- Mover o RDO de `EMERGÊNCIAL - TROCA DE TELHAS` para `TELHADO - NANO CELULOSE` e remover a atividade duplicada (que fica sem RDOs).

### 3. Evitar que o WhatsApp crie atividade repetida

O RDO de 07/09 criou `EMERGÊNCIAL - TROCA DE TELHAS` mesmo já existindo `TELHADO - NANO CELULOSE` com o mesmo serviço. O roteamento passa a considerar também correspondência parcial de palavras-chave do título (telha/telhado, por exemplo) contra o nome das atividades da unidade e os títulos de OM já usados, além da similaridade atual. Só cria atividade nova quando não houver nenhuma correspondência.

O grupo "RDO - SUZANO" continua **sem atividade padrão**, como você pediu.

## Detalhes técnicos

- `src/lib/rdoActivityGroups.ts`: chave do grupo passa a ser `project:<id>` (atividade), com `omNumbers`/`omTitles` agregados e expostos para exibição; a fusão por título deixa de valer entre atividades distintas.
- `src/components/reports/DocumentCabinet.tsx`: substituir o agrupamento local por OM (linhas ~897-953) pela mesma chave por atividade; card exibe nome da atividade + contagem de OMs; a lista interna do mês agrupa RDOs por OM.
- `ClientDashboard.tsx`, `ClientActivityList.tsx`, `ProjectSelector.tsx` e `WorkforceDatabase.tsx` seguem automaticamente por usarem `buildActivityGroups`.
- `supabase/functions/_shared/rdoParser.ts`: em `routeProject`, acrescentar correspondência por sobreposição parcial de tokens significativos (limiar menor, com exigência de token específico) antes de decidir `title_no_match`.
- Atualização de dados: reatribuir `project_id` dos 2 RDOs de telhas para `22354961-75ea-4ab6-88b3-a1846925b98c` e apagar a atividade `4638e58f-9aff-4153-9016-796881d792e7` depois de vazia.

## Verificação

- Abrir Meus RDOs > Suzano Aracruz > Setembro 2026: devem restar 2 cards (housekeeping e telhado da Nano), com as OMs listadas dentro do card de housekeeping.
- Conferir o mesmo mês no portal do cliente e no passo 3 de Criar RDO.
