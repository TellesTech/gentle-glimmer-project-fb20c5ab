# Calendário da atividade com todos os RDOs de Meus RDOs

## Causa confirmada
Em "Meus RDOs" as pastas de atividade agrupam os RDOs pela **OM** (número/título da OM). Uma mesma OM pode ter RDOs criados em atividades diferentes no banco — a pasta reúne todos eles.

Já o calendário da atividade busca RDOs de **uma única atividade** (`project_id` da primeira atividade de origem da pasta). Resultado: os RDOs da mesma OM que foram gravados em outra atividade não aparecem no calendário.

Além disso, o calendário só tem cor/indicador para rascunho, enviado e concluído — RDOs **assinados/finalizados** ficam sem destaque.

## Correção

1. **O calendário passa a carregar todos os RDOs da pasta (OM), não só de uma atividade**
   - Ao abrir o calendário a partir de uma pasta de atividade, todas as atividades de origem daquela pasta são levadas junto.
   - O calendário busca os RDOs de todas essas atividades, ficando idêntico ao conteúdo mostrado em "Meus RDOs".
   - Abrir o calendário por outros caminhos continua funcionando normalmente (apenas a atividade em questão).

2. **Todos os status aparecem**
   - Rascunho, concluído, enviado para assinatura, assinado e finalizado — todos ficam visíveis no dia correspondente.
   - Inclui indicador/cor própria para assinado e finalizado, hoje ausente.

3. **Contagens e métricas do dia**
   - Os contadores de RDOs por dia e o painel do dia selecionado passam a considerar o mesmo conjunto ampliado.

4. **Verificação**
   - Abrir uma pasta em "Meus RDOs", contar os RDOs do mês, abrir o calendário da mesma pasta e conferir que o total do mês bate.

## Detalhes técnicos
- `src/components/reports/DocumentCabinet.tsx`: ao navegar para `/projects/:projectId`, incluir as demais atividades da pasta como parâmetro na URL (ex.: `?projects=id1,id2`).
- `src/pages/ProjectCalendar.tsx`: ler esse parâmetro e trocar `.eq('project_id', projectId)` por `.in('project_id', [projectId, ...extras])` na consulta `project-reports`, incluindo o parâmetro na `queryKey`.
- Estender os mapas de cor/pontos de status (linhas de `statusColor` e dos indicadores por dia) com `signed` e `finalized`, usando tokens semânticos do design system.
- Sem alteração de banco de dados.