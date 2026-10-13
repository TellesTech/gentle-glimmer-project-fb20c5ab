# Nome para cada número de aviso do WhatsApp

## O que muda
- Na lista de "Números para avisos" (Configurações > WhatsApp), cada número passa a ter um **nome** (ex.: "Dayvison", "Ricardo").
- Ao adicionar: dois campos — Nome e WhatsApp (com DDD) — e o botão "Adicionar".
- A lista mostra o nome em destaque com o número embaixo, e o botão de remover continua.
- Os avisos de queda/reconexão e o "Enviar teste" continuam indo para todos os números da lista.

## Detalhes técnicos
- `whatsapp_integration_settings`: nova coluna `alert_contacts` (jsonb, lista de `{ name, phone }`); migração converte os números já salvos em `alert_phones` para a nova lista (sem nome, editável depois). `alert_phones` fica obsoleto.
- `WhatsAppMessagingCard.tsx`: estado passa a ser lista de contatos; adicionar exige nome + número válido; remover por índice/telefone.
- `_shared/whatsappAlert.ts` e `uazapi-status` (test_alert): leem `alert_contacts`, extraindo os telefones; o texto do aviso pode saudar pelo nome (`Olá, Dayvison! ...`).
- Validação de nome (1–60 caracteres) e número (DDD, só dígitos) no cliente e na edge function.
