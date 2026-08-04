# Página do RDO mais larga + downloads em PDF

## O que será feito

### 1. Alargar a página do RDO
`src/pages/ClientReportView.tsx`: o conteúdo hoje está limitado a `max-w-4xl`. Passa para `max-w-6xl` com padding lateral responsivo, aproveitando melhor telas grandes (fotos e anotações ficam maiores).

### 2. Botão "Baixar PDF" no RDO
No cabeçalho vermelho da página do RDO, adicionar um botão "Baixar PDF":
- Se já existe o PDF assinado armazenado, baixa esse arquivo direto.
- Caso contrário, gera o PDF na hora com o gerador já existente (`generateReportPdf`), incluindo fotos, atividades e assinaturas.
- Estado de carregamento no botão e mensagens de sucesso/erro.

### 3. Baixar pasta de RDOs do mês (ZIP)
Na tela de pastas do portal (`src/pages/client/ClientDashboard.tsx`), cada pasta de mês ganha um botão de download (ícone, aparece no hover / sempre no mobile):
- Reúne todos os RDOs daquele mês (de todas as atividades).
- Baixa/gera o PDF de cada um e empacota em um `.zip` chamado `RDOs_Fevereiro_2026.zip`, com subpastas por atividade.
- Indicador de progresso ("3/12") e aviso quando algum RDO falhar.

## Detalhes técnicos

- Novo utilitário `src/lib/clientReportDownload.ts` com:
  - `fetchReportBundle(reportId)` — carrega report + company + site + project + assinaturas (mesma consulta usada em `ReportDetail`).
  - `getReportPdfBlob(reportId)` — usa o `signed_file_url` quando existir, senão `generateReportPdfAsBlob`.
- `ClientReportView.tsx`: botão usa `getReportPdfBlob` + `triggerDownloadFromBlob` (`src/lib/downloadUtils`).
- `ClientDashboard.tsx`: handler `handleDownloadMonth(month)` percorre `month.activities[].reports`, chama `getReportPdfBlob` em sequência, monta o ZIP com `JSZip` (já usado em `ClientReports.tsx`) e dispara o download.
- Downloads sequenciais para não sobrecarregar o navegador; o clique no botão não abre a pasta (`stopPropagation`).
