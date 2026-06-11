## Objetivo
Substituir a integração Z-API por UAZAPI em `https://chatwees.uazapi.com`, mantendo toda a lógica de RDO (parsing, matching de colaboradores/projetos, fotos pendentes, AMT, etc.) intacta — só muda a camada de transporte do WhatsApp.

## Escopo

### 1. Novos secrets (vou pedir quando entrar em build)
- `UAZAPI_TOKEN` — Instance Token da UAZAPI (ex.: `0e93a34d-37d9-4c40-9ec5-8b465f3b8a03`)
- `UAZAPI_ADMIN_TOKEN` (opcional, só se você usar endpoints administrativos da UAZAPI)

URL base fixa em código: `https://chatwees.uazapi.com`.

### 2. Edge Functions

**Criar 3 novas funções** (espelhando as antigas, com a lógica de RDO 100% preservada):

- `supabase/functions/uazapi-webhook/index.ts` — recebe POST da UAZAPI, normaliza o payload (eventos `messages`, `messages_update`, `connection`) para o formato interno que o pipeline RDO já entende. Mantém todas as funções existentes: `isRdoMessage`, `isCorrectionMessage`, `matchCollaborator`, `attachPendingPhotos`, `matchProjectDeterministic`, `identifyProjectWithAI`, etc.
- `supabase/functions/uazapi-status/index.ts` — `GET` retorna status da instância (`/instance/status`), `GET ?action=qr-code` (`/instance/connect` ou `/instance/qrcode`), `GET ?action=list-groups` (`/group/list` paginado), `POST` configura webhook (`/webhook` com `events: ["messages","messages_update","connection"]`).
- `supabase/functions/uazapi-health-check/index.ts` — versão UAZAPI do health check: garante que o webhook aponta para a URL correta, expira `pending_photo` antigos e envia feedback ao grupo via UAZAPI.

**Helpers internos (dentro de cada função)** substituindo os Z-API:
- `sendUazapiText(phone, message)` → `POST /send/text` com header `token: <UAZAPI_TOKEN>`, corpo `{ number, text }`.
- `downloadUazapiMedia(messageOrUrl)` → baixa mídia (UAZAPI envia URL pública ou base64 — trato os dois).
- Marcador no banco: `method: "whatsapp_uazapi"` em vez de `whatsapp_zapi`.

**Deletar** (após confirmação de funcionamento):
- `supabase/functions/zapi-webhook/`
- `supabase/functions/zapi-status/`
- `supabase/functions/zapi-health-check/`
- Secrets `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`

### 3. Frontend — `src/components/settings/WhatsAppSettingsTab.tsx`
- Trocar todas as chamadas `zapi-status` → `uazapi-status` e exibir webhook URL de `uazapi-webhook`.
- Reescrever bloco de diagnóstico de credenciais (não existe mais "instance ID vs token vs URL" — UAZAPI usa um único token).
- Ajustar textos (Z-API → UAZAPI, link/instruções para o painel da UAZAPI).
- QR Code: UAZAPI retorna o QR em base64 no endpoint `/instance/connect` — adaptar parsing.
- Botão "Configurar Webhook" continua, agora chama `uazapi-status` POST que registra eventos `messages`, `messages_update`, `connection` (igual ao print que você mandou).

### 4. Sem mudanças necessárias
- Tabelas (`whatsapp_group_projects`, `whatsapp_rdo_logs`) ficam idênticas — só o `method` muda de valor.
- Toda lógica de matching, parsing de RDO, AMT, AI gateway, atribuição de fotos pendentes.
- `evolution-webhook` (não é Z-API, fica intocado).

## Detalhes técnicos UAZAPI

```text
Base URL: https://chatwees.uazapi.com
Auth header: token: <UAZAPI_TOKEN>   (sempre, em toda chamada)

Endpoints usados:
  GET  /instance/status               → { connected, ... }
  POST /instance/connect              → retorna QR (base64)
  POST /instance/disconnect
  GET  /group/list?...                → lista grupos
  POST /send/text     { number, text }
  GET  /webhook                       → config atual
  POST /webhook       { url, events: [...], enabled: true }

Webhook payload (entrada em uazapi-webhook), exemplo de mensagem:
{
  "event": "messages" | "messages_update" | "connection",
  "instance": { "id": "...", "token": "..." },
  "data": {
    "key": { "remoteJid": "5527...@s.whatsapp.net" | "...@g.us", "fromMe": false, "id": "..." },
    "message": { "conversation": "texto" | "imageMessage": { ... } },
    "pushName": "Nome do remetente",
    "messageTimestamp": 1234567890
  }
}
```

Normalização interna: criar `parseUazapiPayload(body)` que devolve a mesma estrutura que o código RDO já consome hoje (`{ groupId, senderPhone, senderName, text, mediaUrl, isFromMe, ... }`), de modo que zero linha de lógica de RDO precise mudar.

## Plano de execução
1. Pedir segredo `UAZAPI_TOKEN` via `add_secret`.
2. Criar `uazapi-webhook`, `uazapi-status`, `uazapi-health-check` (deploy automático).
3. Atualizar `WhatsAppSettingsTab.tsx` para apontar para as novas funções e exibir a nova URL de webhook (`.../functions/v1/uazapi-webhook`).
4. Atualizar/criar o cron do health check para chamar `uazapi-health-check` (se existir cron Z-API hoje, troco para o novo).
5. Você testa: conectar via QR, mandar um RDO de teste no grupo, validar processamento.
6. Após OK: deletar as 3 funções `zapi-*` e os 3 secrets `ZAPI_*`.

## Riscos / pontos de atenção
- A URL de webhook que você precisa colar no painel UAZAPI será `https://jujzmxbexukxljljpefu.supabase.co/functions/v1/uazapi-webhook` (não o `chatwees.lovable.app/...` do print — aquele era do app Bubble antigo). O botão "Configurar Webhook" na tela de settings faz isso automaticamente.
- Grupos já mapeados em `whatsapp_group_projects` continuam funcionando (o `group_id` no formato `...@g.us` é o mesmo).
- Logs antigos com `method = whatsapp_zapi` ficam preservados; novos virão como `whatsapp_uazapi`.