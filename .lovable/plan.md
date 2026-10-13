# RDOs do dia 8 que não apareceram

## O que foi encontrado
- Não existe nenhum RDO com data de 08/10 no sistema. Ou seja, eles nunca chegaram; não estão escondidos na tela.
- Na pasta de Barroso, o último RDO é o 016, de 02/10. Todos os RDOs dessa pasta vieram do WhatsApp.
- A última mensagem de RDO recebida do WhatsApp foi registrada em **02/10, às 19h58**. Depois disso, nenhuma foi processada.
- Neste momento o WhatsApp da WEES (número 27 99704-1945) está **desconectado**. O motivo informado é "QR Code timeout": o sistema tenta reconectar sozinho, mas sem a leitura do QR Code a conexão não volta.
- Os RDOs criados depois de 02/10 (Suzano Aracruz) foram feitos à mão, por isso apareceram.

Conclusão: os RDOs enviados pelo WhatsApp desde 03/10, incluindo os do dia 8, não entraram no sistema porque o WhatsApp está desconectado.

## O que será feito

1. **Reconectar o WhatsApp (precisa de você)**
   - Em Configurações > WhatsApp, abrir a conexão e ler o QR Code com o celular do número da WEES.
   - Depois disso, os novos RDOs voltam a entrar sozinhos.

2. **Recuperar os RDOs perdidos (03/10 até hoje)**
   - Depois da reconexão, buscar no WhatsApp as mensagens dos grupos vinculados desde 03/10.
   - Processar essas mensagens pelo mesmo caminho dos RDOs normais, com as fotos.
   - A proteção contra duplicados impede criar de novo um RDO que já exista.
   - Se o WhatsApp não liberar o histórico antigo, informar quais grupos e dias faltaram. Nesse caso, os RDOs podem ser reenviados no grupo ou colados com "Colar Relatório do WhatsApp".

## Detalhes técnicos
- `whatsapp_rdo_logs`: último registro em `2026-10-02 22:58 UTC`. Os eventos `connection` em `uazapi-webhook` mostram `status: disconnected` e `lastDisconnectReason: "QR Code timeout"`.
- Recuperação: nova ação em edge function que usa a API da UAZAPI para buscar mensagens por chat (grupos de `whatsapp_group_projects`) a partir de 03/10 e repassar cada uma ao processamento de `uazapi-webhook`. A deduplicação existente continua valendo.
- A recuperação só pode rodar depois que o WhatsApp estiver conectado de novo.
