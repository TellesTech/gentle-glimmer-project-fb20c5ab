# Desfazer a junção errada da OM 4600039631 (CSN Pedro Leopoldo)

## O que deu errado
A OM 4600039631 é um número de contrato usado em várias atividades diferentes (Reparo de ar falso, Mobilização, Causinação, Limpeza de silo, Torre de ciclone etc.). A regra anterior tratou "mesma OM = mesmo card" e juntou 76 RDOs de todas essas atividades em um único card. Os outros cards foram apagados nessa junção e o sistema não guardou a lista antiga de qual RDO estava em qual card.

## Correção
1. **Separar os cards de novo pela atividade de cada RDO** (título da atividade escrito no RDO):
   - "Reparo para eliminar ar falso e reforço estrutural..." fica só com os RDOs dessa atividade (inclui a variação "Reparo para eliminar ar falso no duto...").
   - Cada outra atividade (Mobilização, Causinação, Limpeza de Silo de Escória, Torre de Ciclone, Torre de Arrefecimento, Inspeção no moinho de cru etc.) volta a ter seu próprio card, com a mesma OM, mesma fábrica e status "Em Execução".
   - Nenhum RDO, foto ou assinatura é apagado; só muda o card em que aparece.
2. **Remover a regra que forçava "mesma OM = mesmo card"** no banco e no WhatsApp. Volta a valer: mesma OM **e** mesma atividade = mesmo card. Assim duplicação verdadeira (mesma atividade criada duas vezes) continua bloqueada, mas atividades diferentes da mesma OM ficam separadas.
3. Conferir com você a lista final de cards e quantidades. Se algum RDO cair no card errado, dá para arrastar para o card certo na tela (função de mover já existente).

## Observação
Como a separação antiga não foi registrada, as quantidades podem não bater exatamente com as de antes (ex.: o card de Reparo tinha 15; pela atividade escrita nos RDOs ficará perto de 17).

## Detalhes técnicos
- Migração: `DROP TRIGGER trg_route_report_om` e remover a função `route_report_to_existing_om_project`.
- Dados: para o projeto `02dbdb11...`, agrupar `reports` por `maintenance_order_title` normalizado (minúsculas, sem acento/pontuação, variações de "ar falso" unidas); criar um `projects` por grupo (site, company, OM, nome = título mais frequente) e atualizar `reports.project_id`.
- `uazapi-webhook`: a busca ampla por OM na fábrica passa a exigir atividade compatível (mesma lógica de `rdoActivityGroups`) antes de reaproveitar o card; republicar.
