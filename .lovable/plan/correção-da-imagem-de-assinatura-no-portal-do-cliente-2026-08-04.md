# Correção da imagem de assinatura no portal do cliente

## Situação verificada

- No banco, as 64 assinaturas gravadas em `report_signatures` com `data:image` estão **íntegras**: MIME `image/png`, base64 válido (múltiplo de 4, sem espaços), assinatura binária PNG correta (`89504e47…`) e ~10–14 KB por imagem.
- Ou seja: o problema **não é o dado gravado**. A imagem chega ao HTML (o `<img>` só é renderizado quando o valor começa com `data:image`), mas o navegador falha ao carregá-la e mostra o texto alternativo "Assinatura de …".
- Causa provável ainda **não confirmada**: bloqueio de `data:` em imagens (Content-Security-Policy do host) ou valor alterado no caminho do portal. Isso precisa ser confirmado antes do ajuste definitivo.

## Passo 1 — Confirmar a causa (primeiro item da execução)

Abrir o RDO no portal do cliente e inspecionar o `<img>` da assinatura:
- se o console mostrar erro de CSP (`Refused to load the image 'data:…'`), a correção é servir a assinatura como Blob/URL de objeto em vez de `data:` inline;
- se o `src` estiver vazio, cortado ou com aspas extras, a correção é normalizar o valor antes de renderizar.

O ajuste é aplicado conforme o que o teste indicar — os dois caminhos abaixo já estão previstos.

## Passo 2 — Renderização robusta da assinatura

Em `src/components/client/SignatureTimeline.tsx`:
- normalizar o valor antes de usar (remover espaços, quebras de linha e aspas envolventes; aceitar também assinaturas salvas como URL `http(s)`);
- converter o `data:` em `blob:` via `URL.createObjectURL` quando o carregamento inline falhar, com liberação do objeto ao desmontar;
- adicionar `onError` com estado de falha: em vez do ícone quebrado, exibir um selo discreto "Assinatura registrada" com data/hora, mantendo o layout limpo;
- manter altura e enquadramento atuais da imagem.

## Passo 3 — Aplicar o mesmo tratamento nos outros pontos de exibição

Reaproveitar o mesmo utilitário em:
- `src/pages/ClientReportView.tsx` (assinatura salva do usuário WEES);
- `src/pages/ReportDetail.tsx` (bloco de assinaturas do sistema interno).

## Detalhes técnicos

- Novo utilitário `src/lib/signatureImage.ts`: `normalizeSignatureSrc(value)` (trim, remoção de aspas, validação do prefixo, suporte a URL) e `dataUrlToBlobUrl(value)`.
- Nenhuma mudança de banco de dados, RLS ou Edge Function é necessária — os registros já estão corretos.
- Assinaturas do tipo `autentique:<id>` (que existem no banco) continuam sem imagem inline e passam a exibir o selo "Assinado via Autentique" em vez de nada.
