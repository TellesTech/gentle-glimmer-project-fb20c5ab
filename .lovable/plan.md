## Objetivo

Permitir trocar o número de WhatsApp conectado direto pela tela de Configurações → WhatsApp, com um fluxo guiado: confirmar desconexão → desconectar a instância na UAZAPI → abrir o QR do novo número → confirmar que a reconexão (e webhook) terminou.

## Mudanças

### 1) Edge function `supabase/functions/uazapi-status/index.ts`

Adicionar uma nova ação `action=disconnect` (via `POST`, separada da configuração de webhook que já usa POST sem action):

- Chama `POST /instance/disconnect` na UAZAPI com o `UAZAPI_TOKEN`.
- Retorna `{ disconnected: true, result }` em sucesso ou erro detalhado.
- Mantém o comportamento atual de `POST` sem `action` (configura webhook) — o roteamento passa a olhar `url.searchParams.get("action")` também no POST.

### 2) UI em `src/components/settings/WhatsAppSettingsTab.tsx`

Na seção "Testar Conexão / Conectar WhatsApp" (linhas ~447–492), adicionar um terceiro botão:

- **"Trocar número / Reconectar"** (variant outline, ícone `RefreshCw`).
- Habilitado sempre que as credenciais forem válidas (independente de `connected`), porque o usuário pode querer reconectar mesmo com status indefinido.

Fluxo ao clicar:

1. Abre um `ConfirmDialog` (já existe em `@/components/shared/ConfirmDialog`):
   - Título: "Trocar número de WhatsApp?"
   - Descrição: explica que a sessão atual será encerrada, será necessário escanear um novo QR Code com o novo aparelho/número, e que os mapeamentos de grupos existentes continuam válidos apenas para grupos cujo ID não mudou.
   - Confirm: "Desconectar e reconectar" (destructive).
2. Em confirmação, chama a edge function `uazapi-status?action=disconnect` (POST) com loading.
3. Em sucesso, atualiza `connectionStatus` para `disconnected`, mostra toast "Instância desconectada" e dispara `startQrFlow()` (reaproveita todo o pipeline existente: QR → polling de `connected` → `configureWebhook` → estado `done`).
4. O `Dialog` do QR (já existente) cuida do feedback visual até o final ("WhatsApp conectado e webhook configurado com sucesso!").
5. Após `done`, chama `testConnection()` para refletir o novo estado no badge.

Mensagens de erro tratadas com toast destrutivo; em caso de falha no disconnect, ainda permitir o usuário tentar `startQrFlow` manualmente.

### 3) Texto de ajuda

Atualizar o accordion "📖 Como conectar?" (linhas ~503–518) adicionando um item curto:

> Para trocar o número conectado, use **"Trocar número / Reconectar"** — ele encerra a sessão atual e abre o QR Code do novo número automaticamente.

## Detalhes técnicos

- Endpoint UAZAPI usado: `POST /instance/disconnect` (chatwees.uazapi.com), autenticado pelo header `token` igual aos demais endpoints na função.
- Nenhuma mudança de banco, RLS ou secret.
- Sem alterações no `uazapi-webhook` — o webhook continua o mesmo URL e é re-aplicado pelo `configureWebhook()` existente ao final do QR.
- Os mapeamentos em `whatsapp_group_projects` não são tocados; group IDs de grupos existentes permanecem válidos quando o admin do grupo apenas troca um participante. Grupos novos precisarão de mapeamento como hoje.

## Fora de escopo

- Não vamos detectar/avisar automaticamente quando o número conectado mudou entre sessões.
- Não vamos migrar mapeamentos de um group_id para outro automaticamente.
