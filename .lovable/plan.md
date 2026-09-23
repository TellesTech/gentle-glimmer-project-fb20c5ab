# RDOs baixando sem fotos

## O que já foi verificado no banco

- As fotos estão registradas normalmente: 7.794 fotos ligadas a RDOs, sem perda de vínculo.
- Fotos de junho em diante (3.498) estão no armazenamento atual e abrem normalmente (testado, resposta 200).
- Fotos de maio para trás (4.296) apontam para o armazenamento do sistema antigo, que está **fora do ar**. Esses arquivos não existem no armazenamento atual — checado arquivo por arquivo. Para esses RDOs antigos não há como recuperar a imagem; só é possível mostrar um aviso claro.
- Um PDF assinado recente (RDO 029, 22/09) foi baixado e inspecionado: **contém as 4 fotos**. Ou seja, o gerador consegue embutir fotos; a falha não é geral.

Conclusão: a causa exata da falta de fotos nos seus downloads **ainda não está confirmada**. Por isso o primeiro passo do plano é reproduzir e registrar onde a foto se perde, em vez de chutar uma correção.

## Passo 1 — Descobrir onde a foto se perde (diagnóstico)

Incluir registro de diagnóstico no gerador de PDF (`src/lib/generateReportPdf.ts`, função `loadImageAsBase64` e o bloco de fotos), informando no console, para cada RDO baixado:

- quantas fotos vieram junto com o RDO;
- para cada foto: endereço, se o download da imagem deu certo, tamanho e, se falhou, o motivo (bloqueio, arquivo inexistente, tempo esgotado, formato recusado pelo gerador).

Com isso, um download de teste mostra imediatamente se o problema é (a) o RDO chegar sem nenhuma foto na hora de gerar, (b) a imagem não baixar, ou (c) o gerador recusar a imagem.

## Passo 2 — Correções previstas conforme o resultado

- **Se o RDO chega sem fotos na geração**: unificar o carregamento das fotos em um único caminho, o mesmo usado pela tela (que mostra as fotos corretamente), para os quatro pontos de download: card do RDO, página do RDO, pasta do mês (ZIP) e portal do cliente.
- **Se a imagem não baixa**: baixar as fotos pelo caminho autenticado do armazenamento (link temporário) em vez do endereço público, com nova tentativa automática e limite de tempo maior; hoje uma falha passa em silêncio.
- **Se o gerador recusa a imagem**: detectar o tipo real do arquivo e converter a imagem antes de inserir no PDF.

## Passo 3 — Fotos antigas perdidas (maio para trás)

Nesses RDOs, em vez de espaço vazio, o PDF passa a mostrar um quadro com o aviso "Foto do sistema anterior indisponível", igual ao que a tela já faz. Assim ninguém acha que o RDO foi emitido sem registro fotográfico.

## Passo 4 — Verificação

- Baixar, pelos quatro caminhos, um RDO recente com fotos e conferir as imagens no arquivo.
- Baixar a mesma pasta do mês em ZIP e conferir de 3 a 5 arquivos.
- Baixar um RDO antigo e conferir o aviso no lugar da foto.
- Conferir no PDF gerado a contagem de imagens embutidas, comparando com a quantidade de fotos do RDO.

## Detalhes técnicos

- `src/lib/generateReportPdf.ts`: instrumentar `loadImageAsBase64` (retorno nulo hoje é silencioso) e o laço de fotos; trocar `addImage(..., 'JPEG', ...)` por formato detectado a partir dos bytes; `timeout`/retry no fetch.
- `src/lib/clientReportDownload.ts`: `REPORT_SELECT` já embute `report_photos(*)`; se o diagnóstico mostrar lista vazia sob RLS, buscar as fotos em consulta separada (ou via `get-client-report`) e conferir contagem antes de gerar.
- Placeholder de foto indisponível desenhado com retângulo + texto, reaproveitando o padrão do `SafeImg`.
