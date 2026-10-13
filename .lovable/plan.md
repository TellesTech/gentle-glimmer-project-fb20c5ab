# Número de WhatsApp para avisos

## O que muda
Em Configurações > WhatsApp aparece um campo **"Número para avisos"** (um número só), com botões **Salvar** e **Enviar teste**.

O número da WEES conectado envia para esse número:
- **WhatsApp reconectado** — quando a conexão volta.
- **WhatsApp desconectado** — quando a verificação automática percebe a queda.
- Os avisos no sino e por e-mail continuam como hoje.

## Enviar mensagem para qualquer número
Na mesma tela, um quadro **"Enviar mensagem"**: você digita o número (com DDD) e o texto, e clica em **Enviar**. A mensagem sai pelo WhatsApp que captura os RDOs. Aparece confirmação de enviado ou o motivo do erro (por exemplo, WhatsApp desconectado). Só super admins veem esse quadro.

## Limite importante
Quando o WhatsApp da WEES cai de verdade, ele não consegue enviar nenhuma mensagem, nem o aviso de queda. Por isso:
- O sistema tenta enviar o aviso de queda pelo WhatsApp; se não conseguir, a queda fica avisada só no sino e no e-mail.
- Assim que reconectar, o número cadastrado recebe uma mensagem dizendo que o WhatsApp esteve desconectado e desde quando.

## Detalhes técnicos
- Nova coluna `alert_phone` (texto, só dígitos com DDI 55) em `whatsapp_integration_settings`; edição restrita a super admin pelas regras já existentes da tabela.
- `WhatsAppConnectionSettingsCard.tsx`: campo com máscara, validação (10 a 13 dígitos) e botão de teste.
- `uazapi-status`: nova ação `test_alert` (só super admin) que envia uma mensagem de teste via UAZAPI `/send/text`.
- `_shared/whatsappAlert.ts`: ao gerar aviso "down" ou "up", envia também texto para `alert_phone` usando instância e token de `uazapiConfig`; falha no envio só é registrada no log, sem impedir sino/e-mail. A mensagem de "up" inclui o horário de `connection_changed_at` da queda.
- Publicar `uazapi-status`, `uazapi-health-check` e `uazapi-webhook`.
