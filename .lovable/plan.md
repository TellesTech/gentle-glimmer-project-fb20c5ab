## Objetivo

No "Log de Mensagens" da aba WhatsApp (Configurações), exibir somente mensagens originadas de grupos. Conversas privadas e mensagens sem identificação de origem deixam de aparecer.

## Mudanças

**Arquivo:** `src/components/settings/WhatsAppSettingsTab.tsx`

1. Na query `whatsapp-rdo-logs` (linha ~216), adicionar filtros no Supabase:
   - `.not('group_id', 'is', null)` — descarta mensagens sem `group_id`.
   - `.not('group_id', 'ilike', '%@s.whatsapp.net')` — descarta conversas privadas.
   - Manter `limit(20)` e o `refetchInterval`.

2. No render do log (linha ~694), simplificar a lógica:
   - Remover ramos `isPrivate` e `!gid` (não ocorrerão mais).
   - Manter apenas badges "Grupo mapeado" / "Grupo não mapeado", nome do grupo + unidade/empresa e botão "Usar".

## Fora de escopo

- Webhook, processamento de RDO e tabela `whatsapp_rdo_logs` permanecem inalterados (mensagens privadas continuam sendo registradas, apenas não aparecem no log da UI).
- A seção "Grupos órfãos" já filtra por `group_id not null` e segue como está.
