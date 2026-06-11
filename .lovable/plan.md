# Corrigir: foto enviada via UAZAPI não está sendo registrada

## Causa raiz (confirmada nos logs)

O log mostra `WARNING Image detected but no mediaUrl found`. O UAZAPI envia imagens no formato nativo do WhatsApp: `message.content` contém um objeto com `URL` (link `.enc` criptografado), `mediaKey`, `directPath`, `mimetype`, etc. O parser atual (`parseUazapiPayload`) só procura `mediaUrl`, `image.url`, `message.imageMessage.url` — nenhum desses existe, então `mediaUrl` fica `undefined` e o download é abortado.

Como o `URL` é criptografado (precisa de `mediaKey` para descriptografar), não dá pra baixar direto. A forma correta é pedir o binário pra própria UAZAPI usando o `messageId`.

## Correção

### `supabase/functions/uazapi-webhook/index.ts`

1. **`parseUazapiPayload`**: detectar imagem também quando `messageType === "ImageMessage"` ou `m.content?.mimetype` começa com `image/`. Capturar `m.content?.URL` e `m.content?.mimetype` para uso posterior.

2. **`downloadUazapiMedia`**: quando o parâmetro não for uma URL HTTP utilizável (caso do `.enc` do WhatsApp) ou estiver vazio mas houver `messageId`, fazer um POST para o endpoint de download de mídia da UAZAPI:
   ```
   POST {UAZAPI_BASE_URL}/message/download
   header: token: <UAZAPI_TOKEN>
   body: { id: messageId }
   ```
   Aceitar tanto resposta binária quanto JSON com `fileBase64`/`base64`/`data`.
   Assinatura passa a aceitar `messageId` como fallback: `downloadUazapiMedia(mediaUrl, token, messageId?)`.

3. **Pontos de chamada** (3 lugares — linhas 299, 985, 1518): passar também o `messageId` (`payload.messageId` / `m.id`) como terceiro argumento, para que o fallback funcione mesmo quando `mediaUrl` está vazio.

4. **Filtro de "é imagem?"** no fluxo principal (linha ~1516 e ~947): quando `mediaUrl` for vazio mas `isImage` for true e tiver `messageId`, continuar o caminho de anexo de foto chamando o download por id.

## Validação

Reenviar foto no grupo "RDO - TESTE" → log mostra `Attached … pending photos` ou foto registrada no RDO, e a foto aparece na tela do RDO no app.
