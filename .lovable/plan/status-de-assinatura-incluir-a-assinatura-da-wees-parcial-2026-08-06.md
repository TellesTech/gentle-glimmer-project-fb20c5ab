# Status de assinatura: incluir a assinatura da WEES (parcial)

## Problema (confirmado)

Na lista de RDOs da atividade, a cor do card vem apenas das tabelas de aprovadores (`report_client_approvers` / `report_company_approvers`). A assinatura da equipe WEES é gravada em outra tabela, `report_signatures`, que hoje não é consultada nessa tela.

Verificação no banco (OM 4502439978, Suzano Aracruz), RDOs #001 a #004:
- `report_signatures`: 1 assinatura preenchida em cada RDO (WEES já assinou)
- `report_company_approvers`: 1 aprovador, nenhum aprovado (cliente pendente)
- `status` do relatório: `sent`

Por isso todos aparecem vermelhos, quando deveriam estar em "assinatura parcial".

## Regra desejada

| Situação | Cor |
|---|---|
| Ninguém assinou | Vermelho (Pendente) |
| WEES assinou, cliente ainda não | Amarelo (Assinatura parcial) |
| Cliente assinou (ou RDO `signed`/`finalized`) | Verde (Assinado) |

## Correção

Em `src/pages/client/ClientActivityList.tsx`:
- Buscar também `report_signatures` (contagem por `report_id` com `signature_data` preenchido) junto com as duas consultas de aprovadores.
- Recalcular `approverStatus`:
  - `completed` quando o relatório for `signed`/`finalized`, ou quando todos os aprovadores do cliente estiverem `approved`;
  - `partial` quando houver ao menos uma assinatura interna (WEES) ou algum aprovador aprovado, mas ainda faltar o cliente;
  - `pending` nos demais casos.
- Ajustar os contadores exibidos (`x/y assinadas`) para incluir a assinatura interna no total.
- Atualizar os cartões de estatísticas do topo (Total / Assinados / Parciais / Pendentes) para refletir a nova classificação.

Em `src/pages/client/ClientDashboard.tsx`:
- Aplicar a mesma classificação nas pastas de atividade e de mês, para que uma pasta cujos RDOs já têm assinatura da WEES apareça como parcial (amarela) em vez de pendente (vermelha), e verde apenas quando o cliente assinar.

## Detalhes técnicos

- Nova consulta: `select report_id, signature_data from report_signatures where report_id in (...)`; contar apenas linhas com `signature_data` não nulo.
- Sem alterações de banco de dados, RLS ou edge functions.
- A legenda existente (Assinado / Assinatura parcial / Pendente) permanece igual.