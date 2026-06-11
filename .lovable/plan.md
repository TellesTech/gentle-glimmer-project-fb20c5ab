## Diagnóstico

Todos os 6 grupos já estavam mapeados em `whatsapp_group_projects`, mas todos com `group_id` no formato antigo da Evolution API: `120363425129092506-group`. A UAZAPI envia o JID nativo do WhatsApp: `120363425129092506@g.us`. O webhook compara string literal, então **nenhum** grupo bate — daí o "Não mapeado" no log de hoje (`120363425129092506@g.us`).

Grupos atualmente mapeados (todos sem `project_id`, só com `site_id`):

| group_id (banco)                  | grupo                       | unidade           |
| --------------------------------- | --------------------------- | ----------------- |
| 120363425129092506-group          | RDO - TESTE                 | Aperam Timóteo    |
| 120363409082781666-group          | RDO PEDRO LEOPOLDO 02.2026  | CSN Pedro Leopoldo|
| 120363358148265977-group          | CSN SERRA                   | CSN - Serra       |
| 120363425703983453-group          | CSN PARANA                  | CSN Paraná        |
| 120363425835827088-group          | RDO Nexa Três marias        | Três Marias       |
| 120363408746728542-group          | RDO - PG BRACELL            | Bahia             |

## Solução

Padronizar `group_id` em **um formato canônico único** em todo o sistema: apenas o número (`120363425129092506`), sem `-group` e sem `@g.us`. Toda comparação no webhook passa por uma função `normalizeGroupId()`.

### 1. Migração de dados (não-destrutiva)
- `UPDATE whatsapp_group_projects SET group_id = regexp_replace(regexp_replace(group_id, '-group$', ''), '@g.us$', '')`
- Mesma normalização em `whatsapp_rdo_logs.group_id` (para histórico ficar consistente)

### 2. `supabase/functions/uazapi-webhook/index.ts`
- Adicionar helper:
  ```ts
  const normalizeGroupId = (id: string | null) =>
    id ? id.replace(/@g\.us$/, '').replace(/-group$/, '') : id;
  ```
- Aplicar em todos os pontos onde `groupId` é usado para `.eq("group_id", ...)` ou para INSERT em `whatsapp_rdo_logs` / `whatsapp_group_projects` (linhas 281, 851, 947, 965, 1030, 1036, 1057, 1085, 1119, 1165, 1215, 1237, 1417, 1528).
- Em `sendUazapiText` continua passando o número puro (`groupId.split("@")[0]`) — o helper já lida bem; manter como está.

### 3. `supabase/functions/uazapi-status/index.ts` (list-groups)
- Ao retornar a lista de grupos da UAZAPI para a UI, devolver `group_id` já normalizado, para que ao salvar mapeamento via `WhatsAppSettingsTab` o registro novo entre canônico desde o início.

### 4. `src/components/settings/WhatsAppSettingsTab.tsx`
- Ao buscar grupos e salvar `whatsapp_group_projects`, gravar `group_id` normalizado (sem `@g.us`, sem `-group`). Sem mudança de UX, só do valor persistido.
- Na visualização "Grupos mapeados" / log, exibir `group_id` cru — funciona pois agora é canônico.

### 5. Validação
Após deploy:
- Verificar via `whatsapp_rdo_logs` que a próxima mensagem do grupo `RDO - TESTE` é processada (sai do status `error: Grupo não mapeado` e passa para `success` ou `pending_photo`).
- Conferir que `Buscar Grupos` na UI ainda funciona e novos mapeamentos salvam canônicos.

## Fora de escopo
- Vincular `project_id` aos grupos (continua opcional, hoje só `site_id`); a UI já permite isso.
- Mudanças na lógica de RDO/parsing/AMT — intactas.
- Limpeza de logs antigos (apenas normalização do `group_id` neles, mantém histórico).

## Riscos
- Se houver código de cliente filtrando logs por `group_id` exato no formato antigo (`...-group`), pode quebrar — fiz `rg` no frontend e o único consumo é exibição textual + filtro pelo valor salvo no próprio `whatsapp_group_projects`, então tudo continua coerente após a normalização em massa.
