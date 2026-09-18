# Mover RDO entre pastas não funciona

## O que está acontecendo

Ao arrastar um RDO para outra pasta, o sistema mostra "movido com sucesso", mas o RDO continua na pasta de origem.

Motivo confirmado no código: as pastas (cards) são montadas **pela atividade do RDO** (o projeto ao qual ele pertence). A ação de mover, porém, só atualiza o **número e o título da OM** do relatório — nunca muda a atividade. Como o agrupamento ignora a OM, nada muda na tela, mesmo com a gravação tendo dado certo.

## Correção

Ao soltar o RDO em outra pasta, gravar também a **atividade da pasta de destino** no relatório, além dos dados de OM:

1. Identificar a atividade de destino a partir da pasta onde o RDO foi solto.
2. Gravar essa atividade no RDO junto com número/título da OM da pasta.
3. Se o destino não tiver atividade identificável, avisar com mensagem de erro em vez de exibir "movido com sucesso".
4. Recarregar a lista após a gravação para que a mudança apareça imediatamente.
5. Mostrar o sucesso apenas quando a movimentação realmente tiver alterado o RDO.

## Detalhes técnicos

- Arquivo: `src/components/reports/DocumentCabinet.tsx`, mutação `mergeReportsMutation` (~linha 390).
- As pastas usam a chave `project:<project_id>` (montagem ~linha 905 e em `src/lib/rdoActivityGroups.ts`); logo o update precisa incluir `project_id` = `targetFolder.sourceProjects[0].id` (ou o id extraído de `targetFolder.id`).
- Manter os campos atuais `maintenance_order_number` / `maintenance_order_title` do destino, para não reintroduzir a divergência de OM já tratada antes.
- Após o update, invalidar `['reports-cabinet-all-v2']` (já existe) e validar erro de permissão do Supabase, exibindo toast destrutivo.
- Validação: `bunx tsgo --noEmit`.
