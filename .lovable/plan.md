# Avisos de WhatsApp para vários números

## O que muda
- **Remover** o quadro "Enviar mensagem" (texto avulso) das Configurações > WhatsApp.
- **Manter apenas** o quadro "Número para avisos", agora com suporte a **vários números**: você adiciona e remove números em uma lista; todos recebem os avisos.
- O envio sai sempre pelo WhatsApp que captura os RDOs (WEES Treinamentos Cursos, +55 27 99704-1945). Você só escolhe quem recebe.

## Como fica
1. **Lista de números para avisos** (só super admin):
   - Campo para digitar um número (com DDD) e botão "Adicionar".
   - Lista dos números cadastrados, cada um com botão de remover.
   - Botão "Enviar teste" que manda uma mensagem de teste para todos os números da lista.
2. **Avisos automáticos**:
   - Quando o WhatsApp cai e não reconecta sozinho, todos os números da lista recebem o aviso de queda (além do sino e do e-mail, que continuam).
   - Quando a conexão volta, todos recebem "WhatsApp reconectado" com o horário da queda.
   - Limite: se o WhatsApp estiver desconectado, ele não consegue enviar o próprio aviso de queda — nesse caso o aviso sai pelo sino e por e-mail, e os números recebem o aviso ao reconectar.

## Detalhes técnicos
- `whatsapp_integration_settings.alert_phone` (texto único) passa a `alert_phones` (lista de textos); migração converte o número já salvo para a lista.
- `_shared/whatsappAlert.ts` passa a enviar para todos os números da lista, registrando falha por número sem derrubar os demais.
- `uazapi-status`: remover a ação `send-message`; `send-test` passa a enviar para toda a lista.
- `WhatsAppMessagingCard.tsx`: remover a seção "Enviar mensagem"; a seção de avisos vira lista com adicionar/remover.
- Validação de número (DDD, só dígitos) no cliente e na edge function.
