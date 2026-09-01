# Adicionar campo "Instance Token" na conexão UAZAPI

Hoje só existe um token (`UAZAPI_TOKEN`, no cofre de segredos) usado por todas as chamadas. A UAZAPI trabalha com dois níveis: **Admin Token** (gerencia instâncias) e **Instance Token** (token da instância conectada, usado em status, QR Code, envio de mensagens e webhook). O card "Conexão da API (UAZAPI)" só mostra o Admin Token.

## O que será feito

No card **Conexão da API (UAZAPI)** (Configurações > WhatsApp, apenas super admin):

- Novo bloco **Instance Token** abaixo do Admin Token:
  - Exibido apenas mascarado (ex.: `••••a1b2c3`) com badge "configurado / não configurado".
  - Botão **"Alterar instance token"** que abre o formulário seguro do Lovable (segredo `UAZAPI_INSTANCE_TOKEN`). O valor nunca vai para o banco nem aparece em texto claro.
- O botão **Testar conexão** passa a mostrar qual token está em uso (instância ou admin) e o status mascarado dos dois.
- Mensagens de diagnóstico indicam quando o instance token está ausente e o sistema está usando o admin token como fallback.

## Detalhes técnicos

- Novo segredo `UAZAPI_INSTANCE_TOKEN` (via `add_secret`, valor fornecido pelo usuário a partir do painel UAZAPI).
- `_shared/uazapiConfig.ts`: nova função `getUazapiToken()` que resolve na ordem: `UAZAPI_INSTANCE_TOKEN` → `UAZAPI_TOKEN` → erro. Retorna também `tokenSource: "instance" | "admin"` para o diagnóstico.
- Funções `uazapi-status`, `uazapi-webhook`, `uazapi-health-check` e `send-portal-credentials-whatsapp` passam a usar `getUazapiToken()` no lugar de ler `UAZAPI_TOKEN` direto. Enquanto o instance token não existir, nada muda (fallback para o admin token atual).
- `uazapi-status` inclui no retorno: `tokenSource`, `instanceTokenMasked` e `adminTokenMasked` para o card exibir os badges.
- `WhatsAppConnectionSettingsCard.tsx`: novo bloco de UI com badge mascarado e botão que chama o formulário de segredos; sem alteração de comportamento para quem não configurar.
