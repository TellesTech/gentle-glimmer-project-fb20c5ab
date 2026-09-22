# Baixar RDO em branco para assinar (sem as assinaturas)

Hoje só existe, no download em lote, a opção "Incluir campos de assinatura em branco" — e mesmo assim as assinaturas já registradas continuam aparecendo no PDF. Não há nenhuma opção desse tipo no card do RDO nem na página do RDO.

## O que será feito

### 1. PDF realmente em branco
Nova opção no gerador de PDF: **ocultar as assinaturas já registradas**. Quando ativa, o bloco "ASSINATURAS" não é impresso e no lugar entram apenas os campos em branco (linha, "Nome:", "Data:" e o rótulo do responsável).

### 2. No card de cada RDO (tela "Meus RDOs" / armário de documentos)
No menu de três pontinhos de cada RDO, duas novas ações:
- **Baixar PDF** — como já é hoje, com as assinaturas.
- **Baixar em branco para assinar** — PDF sem as assinaturas, só com os campos.

Hoje esse menu só aparece para super admin; as duas ações de download ficam visíveis para qualquer usuário que já enxerga o RDO.

### 3. Na página do RDO
O botão "Baixar PDF" vira um botão com seta: clique direto mantém o comportamento atual e a seta abre duas opções — "Com assinaturas" e "Em branco para assinar". Vale para a página interna (WEES) e para a página do portal do cliente.

### 4. No download em lote (pasta)
No diálogo "Opções de Download", ao marcar "Incluir campos de assinatura em branco" aparece uma sub-opção: **"Remover as assinaturas já registradas"**, para o ZIP sair todo em branco para assinatura manual.

## Detalhes técnicos

- `src/lib/generateReportPdf.ts`: `PdfOptions` ganha `omitSignatures?: boolean`; a seção de assinaturas (por volta da linha 1060-1187) é pulada quando ativa. Quando `omitSignatures` for verdadeiro e `includeSignatureFields` não vier informado, os campos em branco são desenhados por padrão, usando como rótulos os signatários esperados do RDO (ou os rótulos padrão Contratada/Contratante).
- `src/lib/clientReportDownload.ts`: `mustRegenerate` passa a considerar também `omitSignatures`, para nunca reaproveitar o PDF assinado armazenado nesse caso.
- `src/components/reports/DocumentCabinet.tsx`: `CardActions` recebe os itens de download para `type === 'report'`, chamando `getReportPdfBlob(id, { pdfOptions: { omitSignatures: true }, forceRegenerate: true })` + `triggerDownloadFromBlob`, com estado de carregamento e toast de erro.
- `src/pages/ReportDetail.tsx` e `src/pages/ClientReportView.tsx`: `handleDownloadPdf` passa a aceitar um parâmetro `blank`; botão dividido com `DropdownMenu`.
- `src/components/reports/BatchDownloadOptionsDialog.tsx`: novo estado `omitSignatures`, repassado no `onConfirm`; `DocumentCabinet.tsx` e `src/pages/Reports.tsx` incluem o campo no `PdfOptions` enviado ao `exportReportsBatch`.
- Sem alterações de banco de dados.

## Validação
- Baixar pelo card e pela página um RDO já assinado (ex.: RDO 005, OM 4600039631) e conferir que o PDF sai sem nenhuma assinatura, apenas com os campos em branco.
- Baixar o mesmo RDO na opção normal e conferir que as assinaturas continuam aparecendo com a borda verde.
- Baixar a pasta do mês com a sub-opção marcada e conferir que todos os PDFs do ZIP saem em branco.
