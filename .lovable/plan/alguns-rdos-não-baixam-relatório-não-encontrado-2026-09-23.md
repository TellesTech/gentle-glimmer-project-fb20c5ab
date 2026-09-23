# Alguns RDOs não baixam ("Relatório não encontrado")

## O que já foi verificado

- Os RDOs da tela (01 a 03/09, CSN Montes Claros) estão íntegros no banco: todos têm atividade, unidade, fábrica e autor válidos, e todos já têm PDF assinado guardado.
- Ou seja, a mensagem "Relatório não encontrado" **não** corresponde à realidade: o RDO existe. O download está transformando qualquer falha na busca (erro de conexão, tempo esgotado, bloqueio) nessa mesma mensagem genérica.

A causa exata ainda **não está confirmada**, porque o download descarta o erro real antes de mostrá-lo. Por isso o primeiro passo é revelar o erro, e não chutar a correção.

## Passo 1 — Mostrar o erro verdadeiro

No download de RDO (`src/lib/clientReportDownload.ts`), registrar e exibir o motivo real da falha em vez de "Relatório não encontrado":

- se o RDO realmente não existe, manter a mensagem atual;
- se houve erro de busca, mostrar o motivo (sem acesso, tempo esgotado, falha de conexão) e registrar detalhes no console para diagnóstico.

## Passo 2 — Tornar o download resistente a falhas

Hoje o download depende de uma única consulta pesada que traz o RDO e todas as suas listas (atividades, desvios, presença, fotos, assinaturas) de uma vez. Se essa consulta falhar por tamanho, tempo ou permissão, nada é baixado.

Mudanças:

1. Buscar primeiro os dados básicos do RDO e, em seguida, cada lista em consultas separadas e paralelas. Uma lista que falhe não derruba o download inteiro.
2. Se nem os dados básicos vierem, tentar pela função do portal (`get-client-report`), que roda com acesso total — mesmo caminho já usado hoje para recuperar fotos.
3. Repetir a tentativa uma vez, com tempo limite, antes de desistir.
4. Quando existe PDF assinado guardado e atualizado, usá-lo como já acontece; se a geração nova falhar, cair para o PDF guardado em vez de mostrar erro.

## Passo 3 — Verificação

- Baixar, um a um, os RDOs da tela que falharam (01 a 03/09) pelos dois caminhos: card e página do RDO.
- Baixar a pasta do mês inteira em ZIP e conferir a contagem de arquivos.
- Conferir, no arquivo gerado, se as fotos continuam saindo.
- Se ainda houver falha, o erro exibido passará a dizer o motivo exato, permitindo a correção definitiva.

## Detalhes técnicos

- `src/lib/clientReportDownload.ts`: separar `REPORT_SELECT` em consulta base (`reports` + `project/site/company`) e consultas filhas (`report_activities`, `report_deviations`, `report_attendance`, `report_photos`, `report_signatures`) via `Promise.allSettled`; propagar `error.message`/`error.code` no throw; retry com `AbortController`; fallback para `supabase.functions.invoke('get-client-report')` e, por fim, para `signed_pdf_url`.
- Pontos de chamada não mudam de assinatura: `DocumentCabinet.tsx`, `Reports.tsx`, `ReportDetail.tsx`, `WeesActionsBar.tsx`, `SignedDocumentsSection.tsx` e o lote continuam usando `getReportPdfBlob`.
