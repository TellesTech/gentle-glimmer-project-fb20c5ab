## Objetivo

Adicionar logs de debug detalhados em `supabase/functions/uazapi-webhook/index.ts` para diagnosticar falhas no download de fotos por `messageId` na UAZAPI.

## Mudanças

### 1. `downloadUazapiMediaById` (linhas 390-430)

Adicionar logs em cada etapa, sempre prefixados com `[UAZAPI-DL]` para facilitar filtro:

- **Antes do fetch**: logar endpoint completo, `messageId`, se o `token` está presente (sem expor o valor — apenas tamanho/últimos 4 chars).
  ```
  [UAZAPI-DL] POST {UAZAPI_BASE_URL}/message/download id={messageId} tokenLen={n}
  ```
- **Resposta não-OK**: incluir status, statusText, `content-type` e os primeiros 300 chars do corpo (para ver mensagem de erro da UAZAPI).
- **JSON sem mídia**: já loga `Object.keys(json)`; adicionar também tamanho de cada chave string (`{key: len}`) e logar até 200 chars do JSON cru para entender o formato real.
- **JSON com base64 inválido**: logar tamanho do `b64` e início (primeiros 40 chars).
- **fileURL fallback**: logar a URL usada e status da segunda requisição.
- **Resposta binária vazia**: logar `byteLength=0` explicitamente.
- **Sucesso**: logar `OK bytes={n} via={json|binary|fileURL}`.
- **Catch**: já loga; manter, adicionando `messageId` à mensagem.

### 2. `downloadUazapiMedia` (linhas 350-387)

- Logar quando o caminho `byId` é acionado: `[UAZAPI-DL] using byId fallback (encrypted={bool}, hasUrl={bool}, hasMessageId={bool}, hasToken={bool})`.
- Quando o byId falha e cai no fluxo HTTP normal, logar warning explícito: `[UAZAPI-DL] byId returned null, attempting direct fetch`.
- Quando o fetch direto falha (`!response.ok`), logar status e a URL (host apenas, sem query) ao invés de retornar null silenciosamente.

### 3. Flag opcional de debug

Ler `Deno.env.get("UAZAPI_DEBUG")`. Quando `=== "1"`, ativar logs verbosos adicionais (corpo cru, primeiros bytes em hex). Os logs básicos do item 1 e 2 ficam sempre ativos — a flag só controla os mais ruidosos. Padrão: desativado, para não poluir o log em operação normal.

## Validação

Reenviar foto no grupo "RDO - TESTE". No log da função `uazapi-webhook`, filtrar por `[UAZAPI-DL]` para ver:
- qual endpoint foi chamado;
- status HTTP;
- formato da resposta (JSON/binário) e chaves retornadas;
- motivo exato da falha (token errado, id inválido, resposta vazia, base64 corrompido, etc.).

Com essa informação fica possível decidir o próximo passo (ajustar endpoint, payload, header de auth, etc.).
