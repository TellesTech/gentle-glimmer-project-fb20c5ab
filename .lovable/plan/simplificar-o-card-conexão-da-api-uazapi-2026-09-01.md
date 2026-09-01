# Simplificar o card "Conexão da API (UAZAPI)"

## Objetivo
Deixar na tela apenas o essencial para o WhatsApp funcionar, removendo informação e opções desnecessárias. Como a instância já existe no painel UAZAPI (weeschat.uazapi.com, token `aa17...`), o fluxo principal passa a ser: **colar o token da instância e salvar** — sem precisar criar instância pelo sistema.

## O que muda na tela

**Antes (atual):** Server URL + Webhook URL + eventos + bloco Instância (criar/desconectar/excluir) + bloco Admin Token + bloco Instance Token + 3 botões (Salvar, Testar, Aplicar webhook).

**Depois (novo):**

```text
┌─ Conexão do WhatsApp (UAZAPI) ─────────────────┐
│ Server URL      [ https://weeschat.uazapi.com ] │
│ Token da instância [ aa172403-... ] (editável)  │
│ Status: ● desconectada                          │
│ [ Salvar ]   [ Conectar WhatsApp (QR Code) ]    │
└─────────────────────────────────────────────────┘
```

- **Server URL**: campo único, editável (valor atual: `https://weeschat.uazapi.com`).
- **Token da instância**: campo editável salvo no banco (`whatsapp_integration_settings.instance_token`), exibido mascarado depois de salvo. Ao salvar, o **webhook é aplicado automaticamente** na UAZAPI.
- **Status**: badge conectada/desconectada (reuso do teste de conexão existente).
- **Botão "Conectar WhatsApp"**: atalho direto para o modal de QR Code já existente.

## O que é removido da tela
- Campo "Webhook URL" e "Eventos do webhook" (viram fixos/padrão no backend — não precisam de edição manual).
- Bloco "Admin Token" (permanece no cofre, usado só pelo backend para criar instância — não aparece mais).
- Botões "Aplicar webhook" e "Testar conexão" separados (webhook aplicado no salvar; status aparece automaticamente).
- Ações de criar/excluir instância pela UI ficam **ocultas** (opcionais, atrás de um link discreto "Avançado", ou removidas — o usuário já tem instância no painel UAZAPI).

## Detalhes técnicos
- Editar apenas `src/components/settings/WhatsAppConnectionSettingsCard.tsx` (versão simplificada) e o texto/labels.
- Manter `uazapi-status` (salvar config + aplicar webhook na mesma chamada) e `_shared/uazapiConfig.ts` (prioridade: token do banco → env instance → admin) — backend não muda.
- Garantir que ao salvar o token, a próxima verificação de status já use o token novo (invalidar cache do `getUazapiConfig`).
- Pré-preencher Server URL com `https://weeschat.uazapi.com` e salvar o token da instância `aa172403-5a79-4b7f-97e8-04d1fd6dedc2` no banco (via run_sql), já que o usuário mostrou esses dados no painel UAZAPI.

## Validação
- Salvar token → webhook aplicado → status muda ao conectar via QR Code.
- TypeScript limpo e preview funcionando.
