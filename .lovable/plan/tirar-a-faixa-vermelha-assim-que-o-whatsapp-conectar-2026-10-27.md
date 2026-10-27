# Tirar a faixa vermelha assim que o WhatsApp conectar

## Problema
A tela de Configurações confirma "conectada", mas o registro de status salvo continua como "desconectado". A faixa lê esse registro, então ela não some.

## O que muda
1. Sempre que a verificação de status (botão de atualizar, abertura da tela, leitura do QR Code ou verificação automática a cada 5 min) encontrar o WhatsApp conectado, o status salvo passa para "conectado", com a data/hora. Isso dispara o aviso de reconexão e entrega os avisos pendentes aos números cadastrados.
2. Depois de ler o QR Code, a tela confere o status a cada poucos segundos até conectar e atualiza a faixa na hora.
3. A faixa também verifica o status real ao abrir qualquer página. Se o WhatsApp estiver conectado, ela some sozinha, mesmo que o registro ainda esteja antigo.

## Detalhes técnicos
- `uazapi-status` (ação de status): quando a instância estiver `connected` e o registro estiver diferente, atualizar `connection_status='connected'` e `connection_changed_at=now()`, depois chamar o envio de reconexão/pendentes que já existe.
- `WhatsAppConnectionSettingsCard`: depois de status conectado ou de ler o QR, invalidar a query `whatsapp-connection-status`.
- `WhatsAppStatusBanner`: enquanto estiver desconectado, chamar `uazapi-status` a cada 15 s em vez de apenas ler a tabela.
- Publicar `uazapi-status`.
