# RDOs do WhatsApp sempre no card da OM correta

## Problemas encontrados na regra atual
1. Quando a OM já aparece em RDOs de mais de um card (por exemplo, um RDO que caiu no card errado), o sistema pega o primeiro que encontrar, sem critério — o erro se repete.
2. Só procura cards ativos ou mexidos nos últimos 120 dias. Se a OM é de um card mais antigo, cria um card novo duplicado.
3. A busca é só dentro da unidade do grupo; se o grupo estiver ligado à unidade errada, a OM vai para outro lugar.
4. Se a mensagem traz número de OM, mas ele vem com formatação diferente (ex.: "OM 4600039631" vs "4600039631/01"), pode não casar.

## O que vai mudar
- **OM manda em tudo:** se a mensagem tem número de OM, o RDO vai para o card cujo nome/código tem essa OM. Esse vínculo passa na frente dos RDOs já existentes.
- **Empate resolvido pela maioria:** se a OM aparece em RDOs de vários cards, vence o card com mais RDOs dessa OM (e mais recentes); RDOs movidos manualmente contam como confirmação.
- **Sem limite de 120 dias** para casar por OM — evita card duplicado.
- **Procura na empresa toda** quando a OM não está na unidade do grupo; se achar em outra unidade, usa esse card e registra o aviso no log.
- **Número normalizado** (só dígitos principais) para comparar OMs.
- **Nunca troca para card com OM diferente:** casamento por título só acontece se a mensagem não tiver OM, e nunca para um card que tem outra OM no nome.
- **Correção dos já errados:** relatório listando RDOs do WhatsApp cuja OM não bate com a OM do card, e correção automática movendo-os para o card certo (com registro no histórico).

## Detalhes técnicos
- `supabase/functions/_shared/rdoParser.ts` `routeProject`: prioridade nome/código do projeto > contagem ponderada em `reports`; bloquear rota por título para projeto com OM distinta; normalização em `omKey`.
- `uazapi-webhook/index.ts`: remover corte de 120 dias para matching por OM; fallback de busca por `company_id`; registrar `route.reason` em `whatsapp_rdo_logs`.
- Testes Deno para `routeProject` cobrindo empate, OM formatada diferente e bloqueio por título.
- Script SQL de conferência + migração de dados movendo RDOs com OM divergente, gravando em `report_history`.
