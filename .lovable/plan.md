## Objetivo

Hoje a pausa da automação do WhatsApp é global (campo `whatsapp_automation_paused` em `system_settings`). O pedido é ter esse controle **individual por unidade**, ou seja, por grupo mapeado em "Mapeamento Grupo — Unidade".

## O que será feito

### 1. Banco de dados
- Adicionar a coluna `automation_paused` (booleano, padrão `false`) na tabela `whatsapp_group_projects`.
- Manter o interruptor global existente como "chave mestra": se o global estiver pausado, tudo fica pausado; se estiver ativo, cada unidade decide.

### 2. Webhook (`uazapi-webhook`)
- Após identificar o grupo/unidade da mensagem, verificar também a pausa daquela unidade.
- Se a unidade estiver pausada: registrar o log da mensagem com status "ignorado (pausado)" e não criar RDO — mesmo comportamento já usado na pausa global.

### 3. Tela de configurações do WhatsApp
- Na seção "Automação do WhatsApp", manter o interruptor global e deixar claro que ele afeta todas as unidades.
- Na lista "Mapeamento Grupo — Unidade", adicionar em cada linha:
  - um interruptor "Automação" (ativa/pausada) para aquele grupo/unidade;
  - um selo visual de estado (Ativa / Pausada), desabilitado e exibido como "Pausada pelo global" quando a pausa geral estiver ligada.
- Salvamento imediato ao alternar, com aviso de sucesso e atualização da lista.

## Detalhes técnicos
- Migração: `ALTER TABLE public.whatsapp_group_projects ADD COLUMN IF NOT EXISTS automation_paused boolean NOT NULL DEFAULT false;` (RLS/grants já existentes na tabela permanecem).
- `supabase/functions/uazapi-webhook/index.ts`: incluir `automation_paused` nos `select` do mapeamento e adicionar o early-return por unidade.
- `src/components/settings/WhatsAppSettingsTab.tsx`: nova mutation `toggleGroupPause` + coluna de interruptor na lista de mapeamentos.
