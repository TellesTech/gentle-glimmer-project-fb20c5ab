# RDO enviado para assinatura deve aparecer na Área do Cliente

## Problema
Ao clicar em "Enviar para Assinatura", o RDO recebe o status `sent`. Porém tanto a regra de segurança do banco (`can_view_portal_report`) quanto as telas do portal só liberam RDOs com status `signed` ou `finalized`. Resultado: o cliente não vê o RDO que foi enviado justamente para ele assinar.

## O que será feito
1. **Banco (visibilidade)**: atualizar a função `can_view_portal_report` para incluir o status `sent` junto de `signed` e `finalized`. As demais regras continuam iguais:
   - só RDOs de unidades às quais o usuário pertence;
   - meses ocultados pela WEES continuam invisíveis (regra soberana).
2. **Telas do portal**: incluir `sent` nos filtros de status em:
   - `src/pages/client/ClientDashboard.tsx` (listagem, contagem das pastas e métricas)
   - `src/pages/client/ClientActivityList.tsx` (lista de RDOs da atividade)
3. **Indicação visual**: RDO com status `sent` aparece como "Aguardando assinatura" (pendente) e só conta como assinado quando as assinaturas forem concluídas. As métricas separam "Pendentes" de "Assinados".
4. **Organização em pastas**: o RDO enviado entra automaticamente na pasta do mês/ano correspondente à data do RDO (Empresa > Unidade > Ano > Mês > Atividade), igual aos já assinados. Se a pasta do mês ainda não existir na visão do cliente, ela passa a aparecer com a contagem atualizada; se o mês estiver oculto pela WEES, o RDO continua invisível.
5. **Assinatura**: o cliente continua podendo assinar apenas os RDOs em que foi designado como aprovador.

## Detalhes técnicos
- Migração `CREATE OR REPLACE FUNCTION public.can_view_portal_report` com `r.status IN ('sent','signed','finalized')`. Nenhuma política precisa ser recriada, pois todas já chamam essa função.
- Nos fetches do portal, trocar `.in('status', ['signed','finalized'])` por `.in('status', ['sent','signed','finalized'])` e ajustar os predicados de "assinado" para não tratar `sent` como concluído.
- O agrupamento por mês usa a data do RDO (`reports.date`) com índice de mês base-0, mesmo padrão já usado em `portal_hidden_months` — nenhuma mudança na chave de agrupamento, apenas os novos registros passam a entrar na contagem da pasta.