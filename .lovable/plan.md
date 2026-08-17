# Opção "Baixar somente assinados" no download em lote

## O que será feito

No diálogo "Opções de Download" (o mesmo da imagem), adicionar uma segunda opção acima da atual:

- **Baixar somente RDOs assinados** — com texto de apoio "Ignora rascunhos e RDOs ainda sem assinatura".
- Quando marcada, o contador do diálogo passa a mostrar quantos dos RDOs da pasta serão realmente baixados (ex.: "Baixar 7 de 11 relatório(s)").
- Se nenhum RDO da pasta estiver assinado, o botão "Baixar" fica desabilitado com aviso "Nenhum RDO assinado nesta pasta".
- Após o download, o aviso de conclusão informa quantos foram baixados e quantos foram ignorados por não estarem assinados.

A opção vale para todos os pontos que usam esse diálogo (pastas de empresa, unidade, ano, mês e atividade em "Meus RDOs").

## Detalhes técnicos

- `src/components/reports/BatchDownloadOptionsDialog.tsx`: novo estado `onlySigned` (padrão desmarcado), incluído no objeto passado para `onConfirm`. Nova prop opcional `signedCount` para exibir o contador filtrado e desabilitar o botão quando for zero.
- `src/components/reports/DocumentCabinet.tsx`: ao abrir o diálogo, além de `reportIds`, guardar também os ids cujo `status` é `signed`/`finalized` (dados já carregados no cabinet) e passar como `signedCount`; em `handleDownloadWithOptions`, quando `onlySigned` estiver ativo, enviar apenas essa lista para `exportReportsBatch` e ajustar o toast final.
- `src/pages/Reports.tsx`: mesmo ajuste no ponto que usa o diálogo, para manter comportamento idêntico.
- Sem mudanças no gerador de PDF nem no banco de dados; a lógica de assinaturas continua igual (o ZIP segue usando `getReportPdfBlob`).

## Validação
- Abrir a pasta OM-22461261 (Suzano Aracruz, Julho/2026), marcar "Baixar somente RDOs assinados" e conferir que o ZIP traz apenas os RDOs com assinatura, com as assinaturas visíveis no PDF.
