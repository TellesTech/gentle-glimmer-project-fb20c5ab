# Adicionar Instance Token na conexão UAZAPI

Hoje só existe o Admin Token (UAZAPI_TOKEN) no cofre de segredos. A UAZAPI fornece também um **token por instância**, que é o correto para as chamadas quando há mais de um número/instância. A tela atual (Configurações > WhatsApp > Conexão da API) não mostra essa opção.

## O que será feito

1. **Novo segredo `UAZAPI_INSTANCE_TOKEN`** no cofre de segredos (o valor nunca vai para o banco nem aparece na tela — só mascarado, ex.: `••••3b8a03`).

2. **Prioridade de uso em todas as edge functions** (uazapi-status, uazapi-webhook, uazapi-health-check, send-portal-credentials-whatsapp):
   - Se `UAZAPI_INSTANCE_TOKEN` existir → usa ele.
   - Se não → cai para o `UAZAPI_TOKEN` (admin) como fallback.
   - Nada muda enquanto o instance token não for cadastrado.

3. **Na tela "Conexão da API (UAZAPI)"**, nova seção **Instance Token** com:
   - Badge mostrando "configurado (••••xxxx)" ou "não configurado";
   - Indicação de qual token está em uso agora (instance ou admin);
   - Instrução de que a troca é feita pelo formulário seguro de segredos (botão abre o cofre).

4. **Teste de conexão** passa a informar no diagnóstico qual token foi usado (`tokenSource: "instance" | "admin"`), para facilitar a conferência após cadastrar o instance token.

## Detalhes técnicos

- `_shared/uazapiConfig.ts`: nova função `getUazapiToken()` que resolve na ordem instance → admin e retorna também as versões mascaradas.
- `uazapi-status/index.ts`: usa `getUazapiToken()` e retorna `tokenSource`, `instanceTokenMasked`, `adminTokenMasked` no JSON de diagnóstico.
- As demais funções passam a usar `getUazapiToken()` no lugar de ler `Deno.env.get("UAZAPI_TOKEN")` direto.
- `WhatsAppConnectionSettingsCard.tsx`: bloco visual do Instance Token ao lado do Admin Token + exibição do `tokenSource` no resultado do teste.
- Depois de implementado, abro o formulário seguro para você colar o valor do instance token.
