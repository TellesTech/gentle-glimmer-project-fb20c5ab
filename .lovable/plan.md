# Corrigir a equipe dos RDOs da CSN Pedro Leopoldo

## O que foi encontrado
Nos RDOs de 14/09 a 22/09 (nº 38 a 45) a equipe está certa:
- Vanderson Rocha: Supervisor Escalador N3
- Daniel de Oliveira Magalhães: Soldador Escalador N1
- Ricardo Muniz Stefanelli: Caldeireiro Escalador N1
- Gilderson Mendes Campos: Soldador Escalador N1
- Victor Hugo Soares dos Santos Silva: Mecânico Escalador N1

Nos RDOs de 23/09 em diante (nº 46, 47 e 48, e o nº 5 de 29/09, da atividade "substituição de telhas e reparo no elevador do forno 2"), os quatro colaboradores aparecem com a função "Convencional" e com o nome abreviado ou escrito de outro jeito (ex.: "Daniel Magalhães", "Ricardo Muniz Estefaneli").

## Correção
1. Em todos os RDOs da CSN Pedro Leopoldo com essa equipe, deixar nome e função iguais aos corretos acima, e ligar cada pessoa ao próprio cadastro no sistema.
2. Arrumar também os RDOs mais antigos da mesma fábrica que tenham a mesma falha (nome diferente ou função "Convencional" para essas cinco pessoas).
3. Gerar de novo o PDF dos RDOs corrigidos: o PDF guardado fica desatualizado e o próximo download já sai certo, graças à regra de atualização que já existe.
4. Evitar que volte a acontecer: nos RDOs que chegam pelo WhatsApp, quando o nome for parecido com o de um colaborador cadastrado (ex.: "Daniel Magalhães"), usar o nome completo e a função do cadastro no lugar de "Convencional".

## Verificação
- Conferir no banco que os RDOs 46, 47, 48 e 5 mostram as funções corretas.
- Baixar um deles e ver a equipe certa no PDF.

## Detalhes técnicos
- Atualizar `report_attendance.user_name`, `function_role` e `user_id` (achar em `profiles` por nome parecido) para os RDOs de sites com nome `%pedro leopoldo%`; o histórico fica registrado pelo `log_report_changes`.
- Webhook do WhatsApp (`rdoParser`/`upsertAttendance`): comparar nomes sem acento e com trigram (`similarity`) contra `profiles` ou a equipe do RDO anterior da mesma atividade; se a função vier "Convencional" ou vazia, usar `function_role`/`job_title` via `resolveWorkerFunction`.
