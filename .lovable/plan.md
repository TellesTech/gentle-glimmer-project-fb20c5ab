# Editar configurações de conexão do WhatsApp (UAZAPI)

Hoje a URL do servidor (`https://chatwees.uazapi.com`) está fixa no código das funções e o token só existe como segredo, sem nenhuma tela para conferir ou trocar. O erro "Não foi possível gerar o QR Code" acontece quando esses valores estão errados e não há como corrigi-los sem alterar código.

## O que será feito

Na aba **Configurações > WhatsApp**, uma nova seção "Conexão da API" (visível apenas para super admin) com:

- **Server URL** — campo editável, salvo no banco, com validação de formato (https, sem barra no final).
- **URL do Webhook** — campo editável, com valor padrão sugerido (a função `uazapi-webhook` do projeto) e botão "Restaurar padrão" + "Copiar".
- **Admin Token / Token da instância** — mostrado apenas mascarado (ex.: `••••3b8a03`) com status "configurado / não configurado" e botão **"Alterar token"**, que abre o formulário seguro do Lovable. O valor continua no cofre de segredos, nunca no banco.
- Botões **Salvar**, **Testar conexão** e **Reaplicar webhook na UAZAPI** (envia a URL salva para a UAZAPI).
- Mensagens de diagnóstico claras quando o teste falhar (token ausente, URL inválida, instância desconectada).

## Detalhes técnicos

- Nova tabela `public.whatsapp_integration_settings` (linha única): `base_url`, `webhook_url`, `webhook_events`, `updated_at`, `updated_by`. GRANTs + RLS: leitura e escrita apenas para `super_admin` (via `has_role`).
- Nova função `get_whatsapp_runtime_config()` (security definer) usada pelas edge functions para ler a configuração com service role.
- Edge functions `uazapi-status`, `uazapi-webhook`, `uazapi-health-check` e `send-portal-credentials-whatsapp` passam a resolver a base URL nesta ordem: banco → variável `UAZAPI_BASE_URL` → padrão atual. Nenhum comportamento muda enquanto o banco estiver vazio.
- Token continua lido de `Deno.env.get("UAZAPI_TOKEN")`; a troca é feita pelo formulário seguro de segredos.
- `WhatsAppSettingsTab.tsx` ganha a seção de conexão e passa a usar a URL salva nas chamadas de status/QR Code.
