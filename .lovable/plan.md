# Silenciar respostas do bot no grupo do WhatsApp

## Mudança

Na edge function `uazapi-webhook`, remover todas as chamadas `sendUazapiText` que enviam mensagem para o grupo, deixando o bot 100% silencioso. Os 4 pontos:

1. `attachPendingPhotos` — `✅ RDO #X concluído e salvo...` (linha 332)
2. Foto avulsa anexada após o RDO — mesma confirmação (linha 1025)
3. Múltiplas atividades ambíguas — `🤔 Esta unidade tem N atividades...` (linha 1239)
4. Confirmação final do RDO criado/atualizado — `📝 RDO #X recebido...` / `✅ RDO #X concluído...` (linha 1701)

O processamento, registro no banco, anexo de fotos e logs continuam funcionando normalmente — apenas o envio de resposta no grupo é removido.

A função `sendUazapiText` é mantida no arquivo caso seja necessária no futuro, mas não é mais chamada.

## Validação

Enviar RDO no grupo "RDO - TESTE" → o bot não responde nada no grupo, mas o RDO é registrado e visível no app.
