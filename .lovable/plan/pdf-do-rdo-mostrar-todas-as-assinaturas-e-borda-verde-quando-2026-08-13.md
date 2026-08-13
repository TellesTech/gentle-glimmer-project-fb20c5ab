# PDF do RDO: mostrar todas as assinaturas e borda verde quando assinado

## Problema confirmado
No RDO 021 (id 895855fa…) existem **2 assinaturas** no banco (Ricardo Gabriel Barcelos – PLANEJADOR/WEES e Lucas Rosa – Cliente), o relatório está com status `signed`, e o campo `signed_pdf_url` já está preenchido.

O download do cliente (`src/lib/clientReportDownload.ts`) baixa preferencialmente o PDF armazenado em `signed_pdf_url`. Esse arquivo foi gerado no momento da **primeira** assinatura, então mostra apenas 1 assinatura — exatamente o PDF enviado. Além disso, o bloco de assinaturas no gerador usa sempre a cor primária (vermelho) na borda.

## O que será feito

1. **Sempre refletir o estado atual das assinaturas**
   - No download do cliente, deixar de usar o PDF armazenado quando ele estiver desatualizado: comparar a quantidade/última data de assinatura em `report_signatures` com a data de geração do PDF salvo. Se houver assinatura mais recente, regerar o PDF na hora.
   - Aplicar a mesma regra nos demais pontos de download (área WEES e download de pasta do mês em ZIP), para nunca entregar um PDF com assinatura faltando.

2. **Borda verde quando assinado**
   - No bloco "ASSINATURAS" do gerador de PDF, usar verde na borda de cada assinatura já concluída (com data/imagem), mantendo cinza/neutro apenas em campos de assinatura em branco.
   - Manter o restante da identidade visual (vermelho WEES) inalterado nos demais blocos.

3. **Ordem e rótulo das assinaturas**
   - Listar todas as assinaturas em ordem cronológica, indicando nome, função e origem (WEES ou Cliente), e ajustar o contador do cabeçalho da seção para o total real.

## Detalhes técnicos
- `src/lib/clientReportDownload.ts`: adicionar checagem de frescor do `signed_pdf_url` (usar `max(signed_at)` de `report_signatures` vs. `reports.updated_at`/metadados do arquivo) antes de reutilizá-lo.
- `src/lib/generateReportPdf.ts`: no laço de `manualSignatures`, escolher `setDrawColor` verde quando `sig.signedAt` existir; ordenar por `signedAt`.
- `src/lib/generateBatchReportsPdf.ts` e pontos em `ClientReportView.tsx` / `DocumentCabinet.tsx`: usar o mesmo helper de obtenção do blob para consistência.
- Sem alterações de banco de dados.

## Validação
- Baixar o PDF do RDO 021 pela área do cliente e conferir as duas assinaturas com borda verde.
- Baixar o mesmo RDO pela área WEES e pelo ZIP do mês e conferir o mesmo resultado.
