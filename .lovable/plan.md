# "Baixar todos": PDFs do ZIP sem as assinaturas

## O que foi verificado
- No banco, os RDOs de Julho/2026 têm sim as assinaturas gravadas com imagem (ex.: RDO 27 e 28 com "Ricardo Gabriel Barcelos — COORDENADOR/WEES" e "Lucas Rosa — Cliente", ambas com imagem e data).
- O download individual (`src/lib/clientReportDownload.ts` → `getReportPdfBlob`) reaproveita o PDF assinado quando ele está atualizado e, caso contrário, regera com todas as assinaturas.
- O "Baixar todos" usa um caminho **diferente** (`src/lib/generateBatchReportsPdf.ts` → `exportReportsBatch` → `fetchReportForPdf`), com consulta e mapeamento próprios. É aí que as assinaturas se perdem.

A causa exata dentro desse caminho ainda não está confirmada (mapeamento incompleto do relatório x falha ao carregar a imagem da assinatura). Por isso o primeiro passo do plano é confirmar, e não adivinhar.

## Plano

1. **Confirmar a falha**
   - Gerar o ZIP de uma pasta conhecida (Julho/2026 — REVITALIZAÇÃO TR09) pelo mesmo código do botão e inspecionar o PDF de um RDO já assinado, comparando com o PDF baixado individualmente.
   - Registrar se o bloco "ASSINATURAS" some por completo (dados não chegam) ou aparece sem a imagem (falha ao desenhar).

2. **Unificar o caminho de geração**
   - Fazer a exportação em lote usar o mesmo utilitário do download individual, para que exista uma única regra de dados e de assinaturas.
   - O ZIP passa a conter, para cada RDO: o PDF assinado armazenado quando estiver atualizado, ou um PDF regerado na hora com todas as assinaturas (WEES + Cliente), com borda verde nas já assinadas.
   - Manter a opção "campos em branco para assinatura" funcionando: quando marcada, o PDF é sempre regerado com esses campos, sem substituir as assinaturas reais.

3. **Alinhar os demais downloads em lote**
   - Aplicar a mesma origem de PDF no ZIP do mês do portal do cliente e na exportação em lote da tela de Relatórios, para não sobrar nenhum caminho antigo.

4. **Falhas visíveis**
   - Hoje um RDO que falha é ignorado em silêncio. Passar a contabilizar e avisar quantos RDOs falharam ao final do download.

## Detalhes técnicos
- `src/lib/generateBatchReportsPdf.ts`: substituir `fetchReportForPdf` + `generateReportPdfAsBlob` pelo `getReportPdfBlob` de `src/lib/clientReportDownload.ts`, estendido com um parâmetro opcional `pdfOptions` e um `forceRegenerate` (usado quando há campos em branco solicitados).
- `src/lib/clientReportDownload.ts`: expor esse parâmetro e manter a checagem de frescor do `signed_pdf_url` já existente.
- Pontos de uso: `src/components/reports/DocumentCabinet.tsx`, `src/pages/client/ClientDashboard.tsx`, `src/pages/Reports.tsx`.
- Sem alterações de banco de dados.

## Validação
- Baixar a pasta Julho/2026 pelo "Baixar todos" e conferir os RDOs 27 e 28: duas assinaturas visíveis, com imagem, nome, função, data e borda verde.
- Comparar com o download individual do mesmo RDO: os arquivos devem ficar iguais.
- Repetir marcando "campos em branco para assinatura" e conferir que as assinaturas reais continuam presentes.
