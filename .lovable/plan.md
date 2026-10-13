# Número para avisos e envio de mensagens pelo WhatsApp dos RDOs

## Confirmação do desenho
- O WhatsApp que envia as mensagens é **sempre o mesmo**: o número que captura os RDOs (WEES Treinamentos Cursos, +55 27 99704-1945).
- Você escolhe apenas o **número que recebe** os avisos e as mensagens, digitado nas configurações do sistema.

## O que já está pronto (implementado na etapa anterior)
- Em Configurações > WhatsApp, quadro "Número para avisos": campo para cadastrar o número que recebe os avisos (ex.: WhatsApp desconectado), visível só para super admins.
- Quadro "Enviar mensagem": campo de número + texto livre, enviado pelo WhatsApp dos RDOs.
- Aviso de queda: quando o WhatsApp cai e não reconecta sozinho, o número cadastrado recebe mensagem; ao voltar, recebe "WhatsApp reconectado" com o horário da queda.
- Limite conhecido: se o WhatsApp estiver desconectado, ele não consegue enviar nem o próprio aviso de queda — nesse caso o aviso sai pelo sino e por e-mail.

## O que falta fazer
1. **Teste real de envio**: cadastrar um número em "Número para avisos" e clicar em "Enviar teste" para confirmar que a mensagem chega.
2. Se o teste falhar, corrigir o caminho de envio na edge function `uazapi-status` (ação de envio) usando os logs da função.

## Detalhes técnicos
- Envio centralizado em `supabase/functions/_shared/whatsappSend.ts` (usa a instância UAZAPI já configurada em `whatsapp_integration_settings` — a mesma da captura de RDOs).
- Número de avisos salvo em `whatsapp_integration_settings` (coluna `alert_phone`).
- Ações em `uazapi-status`: `send-test`, `send-message` e integração do aviso de queda/reconexão via `_shared/whatsappAlert.ts`.
- Acesso restrito a super admin tanto na tela quanto na edge function.
