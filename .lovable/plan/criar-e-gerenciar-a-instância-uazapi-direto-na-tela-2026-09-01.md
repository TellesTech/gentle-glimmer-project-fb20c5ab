# Criar e gerenciar a instância UAZAPI direto na tela

Hoje a instância do WhatsApp só pode ser criada no painel da UAZAPI, e o token precisa ser colado manualmente no cofre de segredos. O objetivo é fazer tudo dentro do sistema: criar a instância, ver seu status e conectar o QR Code pela própria tela de Configurações > WhatsApp.

## O que será feito

### 1. Botão "Criar instância" na tela
- Na seção "Conexão da API (UAZAPI)", botão **Criar nova instância** (só super admin).
- Abre um diálogo pedindo o **nome da instância** (ex.: `wees-rdo`) e, opcionalmente, o **número do WhatsApp**.
- Ao confirmar, o sistema chama a API da UAZAPI (`POST /instance/init` com o Admin Token), recebe o **instance token** gerado e salva automaticamente — sem precisar copiar/colar nada.

### 2. Onde o token da instância fica guardado
- Nova coluna `instance_token` (texto) na tabela `whatsapp_integration_settings` — acesso restrito por RLS a super admin, e as edge functions leem via service role.
- O token **nunca é exibido em claro na tela** — só mascarado (••••xxxx).
- Prioridade de uso nas funções passa a ser: **token da instância (banco)** → `UAZAPI_INSTANCE_TOKEN` (segredo) → `UAZAPI_TOKEN` (admin, fallback).

### 3. Informações da instância na tela
- Nome da instância, status (conectada/desconectada), número vinculado e QR Code — tudo consultando a UAZAPI com o token salvo.
- Botões: **Conectar (gerar QR Code)**, **Desconectar**, **Excluir instância** (com confirmação) e **Aplicar webhook** (já existe).
- O fluxo de QR Code do modal "Conectar WhatsApp" passa a usar o instance token automaticamente.

## Detalhes técnicos

- **Migration**: `ALTER TABLE whatsapp_integration_settings ADD COLUMN instance_name text, instance_token text;` (GRANTs já existem; RLS já restringe a super admin).
- **`get_whatsapp_runtime_config()`** passa a retornar também `instance_name` e `instance_token` (função security definer, chamada só com service role pelas edge functions).
- **`_shared/uazapiConfig.ts`**: `getUazapiToken()` vira async e resolve na ordem banco → env instance → env admin; retorna `tokenSource: "instance_db" | "instance_env" | "admin"`.
- **Nova ação na `uazapi-status`**: `POST { action: "create-instance", name }` → chama `/instance/init` na UAZAPI com o admin token, salva `instance_name` + `instance_token` no banco e já aplica o webhook configurado.
- **Ação `delete-instance`** para remover a instância na UAZAPI e limpar os campos no banco.
- **`WhatsAppConnectionSettingsCard.tsx`**: bloco "Instância" com nome, status, token mascarado, e os botões criar/conectar/desconectar/excluir.
- Segurança: o token nunca aparece completo no frontend; a criação/exclusão exige super admin autenticado.
