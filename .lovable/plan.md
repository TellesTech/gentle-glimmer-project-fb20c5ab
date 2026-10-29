# Unir cards com a mesma OM e impedir que se repita

## O que aconteceu
Na CSN Pedro Leopoldo, a OM 4600039631 está em 3 atividades diferentes:
- "Reparo para eliminar ar falso e reforço estrutural..." (card principal, 33 RDOs)
- "Mobilização da equipe de Pedro Leopoldo para Arcos – MG" (2 RDOs, criado em 20/10)
- "Substituição de telhas e reparo no elevador do forno 2" (2 RDOs, criado em 31/08)

Quando um RDO chega pelo WhatsApp, o sistema só procura a OM nas atividades em andamento ou alteradas nos últimos 120 dias. Se a atividade original estiver fora desse filtro, ele cria um card novo com a mesma OM.

## Correção dos dados
- Mover os RDOs dos dois cards repetidos para o card principal "Reparo para eliminar ar falso...".
- Apagar os dois cards que ficarem vazios (nenhum RDO, foto ou assinatura é perdido).

## Para não acontecer de novo
1. **WhatsApp**: antes de criar um card, procurar a OM em todas as atividades da fábrica, de qualquer status ou data. Se encontrar, o RDO entra no card existente (e ele volta para "Em Execução" se estava concluído).
2. **Criação manual** (botão Novo Relatório / nova atividade): se a OM digitada já existir em outro card da mesma fábrica, o RDO vai para esse card, com aviso na tela.
3. **Tela de cards**: cards da mesma fábrica com a mesma OM aparecem juntos em um único card, como garantia extra caso algum dado antigo fique duplicado.

## Detalhes técnicos
- `uazapi-webhook/index.ts`: buscar OMs em `reports` de todos os `projects` do site (sem filtro de status/120 dias) para `routeProject`; ao reutilizar projeto concluído, atualizar `status = in_progress`.
- Fluxo de criação de RDO no front: consulta prévia de `reports.maintenance_order_number` por `site_id` normalizado com `omKey`.
- `rdoActivityGroups.ts`: chave de agrupamento `om:{site_id}:{omNormalizada}` quando houver OM, senão `project:{id}`; ações de mover/renomear continuam usando o projeto principal do grupo.
- Dados: `UPDATE reports SET project_id = '02dbdb11…'` onde `project_id in ('abdb5821…','6e36f362…')`, depois remover esses projetos se vazios. Publicar a função do webhook.
