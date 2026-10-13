# Aviso de desconexão para os números cadastrados

## O que muda
Quando o WhatsApp da WEES desconectar, **todos os contatos cadastrados** em "Números para avisos" recebem o aviso de queda — com garantia de entrega:

1. **Tentativa imediata**: assim que a queda é detectada, o sistema tenta enviar o aviso de desconexão pelo WhatsApp para cada contato da lista (funciona quando a queda é parcial, ex.: só o recebimento de mensagens falhou).
2. **Aviso pendente garantido**: se o envio falhar (WhatsApp realmente fora do ar), o aviso fica marcado como **pendente** e é enviado automaticamente a cada contato **assim que a conexão voltar**, dizendo que esteve desconectado e desde quando.
3. **Sino e e-mail continuam** como estão (super admins), independente do WhatsApp.

Ou seja: nenhum contato fica sem saber da queda — ou recebe na hora, ou recebe no momento da reconexão.

## Detalhes técnicos
- `whatsapp_integration_settings`: nova coluna `pending_down_alert_at` (timestamp) marcada quando o aviso de queda não conseguiu sair para todos os contatos.
- `_shared/whatsappAlert.ts`:
  - No evento "down": tenta enviar para cada contato; se algum falhar, grava `pending_down_alert_at`.
  - No evento "up": se houver `pending_down_alert_at`, envia a cada contato a mensagem "esteve desconectado desde <data/hora>" e limpa a marca.
- `uazapi-health-check`: ao detectar reconexão, também dispara o envio do aviso pendente.
- Nada muda na tela de configurações — a lista de contatos já existente é usada.
- Publicar `uazapi-health-check` e `uazapi-status` ao final.
