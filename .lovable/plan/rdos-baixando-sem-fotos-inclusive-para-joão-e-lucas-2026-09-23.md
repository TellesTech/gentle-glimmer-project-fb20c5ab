# RDOs baixando sem fotos (inclusive para João e Lucas)

## O que já foi verificado

- As fotos estão registradas normalmente: 7.794 fotos ligadas a RDOs.
- Fotos de junho em diante (3.498) estão no armazenamento atual e abrem normalmente (testado, resposta 200).
- Fotos de maio para trás (4.296) apontam para o armazenamento do sistema antigo, que está **fora do ar**, e esses arquivos não existem no armazenamento atual (checado um a um). Nesses RDOs antigos a imagem não é recuperável; só dá para mostrar um aviso claro no lugar.
- Permissão de leitura das fotos para João Santos e Lucas Rosa: **liberada** (testado nos RDOs em que eles são signatários). Ou seja, não é bloqueio de acesso.
- Um PDF assinado recente (RDO 029, 22/09) foi baixado e inspecionado: **contém as 4 fotos**. O gerador consegue embutir fotos, então a falha não é geral.

Conclusão honesta: a causa exata ainda **não está confirmada**. Por isso o primeiro passo é reproduzir e registrar onde a foto se perde, em vez de chutar a correção.

## Passo 1 — Descobrir onde a foto se perde

Incluir registro de diagnóstico no gerador de PDF (`src/lib/generateReportPdf.ts`), mostrando, a cada download:

- quantas fotos vieram junto com o RDO;
- para cada foto: endereço, se o download da imagem deu certo, tamanho e, quando falha, o motivo (bloqueio, arquivo inexistente, tempo esgotado, formato recusado).

Com isso, um download de teste na conta do João ou do Lucas mostra na hora se o problema é (a) o RDO chegar sem fotos, (b) a imagem não baixar, ou (c) o gerador recusar a imagem.

## Passo 2 — Correções previstas conforme o resultado

- **RDO chega sem fotos na geração**: usar um único caminho de carregamento das fotos, o mesmo da tela (que exibe corretamente), nos quatro pontos de download: card do RDO, página do RDO, pasta do mês (ZIP) e portal do cliente.
- **A imagem não baixa**: buscar as fotos por link temporário autenticado em vez do endereço público, com nova tentativa automática e tempo limite maior; hoje a falha passa em silêncio e o PDF só mostra "Carregando...".
- **O gerador recusa a imagem**: detectar o tipo real do arquivo e converter antes de inserir no PDF (hoje todas são inseridas como JPEG).

## Passo 3 — Fotos antigas perdidas (maio para trás)

Nesses RDOs, em vez de espaço vazio ou "Carregando...", o PDF passa a mostrar "Foto do sistema anterior indisponível", igual ao que a tela já faz.

## Passo 4 — Verificação

- Baixar, pelos quatro caminhos, um RDO recente com fotos e conferir as imagens no arquivo.
- Repetir entrando como João e como Lucas no portal.
- Baixar uma pasta do mês em ZIP e conferir de 3 a 5 arquivos.
- Baixar um RDO antigo e conferir o aviso no lugar da foto.
- Conferir a contagem de imagens embutidas no PDF contra a quantidade de fotos do RDO.

## Detalhes técnicos

- `src/lib/generateReportPdf.ts`: instrumentar `loadImageAsBase64` (hoje retorna nulo silenciosamente) e o laço de fotos (linhas ~983-1058); `addImage(..., 'JPEG', ...)` passa a usar o formato detectado dos bytes; `fetch` com `AbortController` e retry.
- `src/lib/clientReportDownload.ts`: `REPORT_SELECT` já embute `report_photos(*)`; se o diagnóstico mostrar lista vazia, buscar as fotos em consulta separada (ou via `get-client-report`, que roda com acesso total) e validar a contagem antes de gerar.
- Placeholder de indisponível desenhado com retângulo + texto, no mesmo padrão do `SafeImg`.
