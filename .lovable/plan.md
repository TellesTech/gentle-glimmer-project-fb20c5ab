# Renomear pasta de atividade (OM) — por que não salva e como corrigir

## O que foi verificado
- A tabela `rdo_activity_names` existe, tem permissões corretas e regras de acesso para quem tem acesso à unidade ou ao portal. Já há 1 nome personalizado gravado ("REVITALIZAÇÃO TR09"), ou seja, a gravação funciona.
- O Ricardo (ricardo@wees.com.br) é super admin e tem acesso à unidade — não é bloqueio de permissão.
- Na tela do print (atividade aberta, com a lista "Relatórios") **não existe botão de renomear**. O lápis de renomear só aparece um nível acima, na lista de OMs do mês. Por isso "não é possível editar" e nada acontece (nenhuma mensagem de erro).
- Há ainda uma inconsistência: no portal do cliente, a página da atividade usa a chave da URL como identificador do grupo, enquanto a área WEES e o painel do cliente usam a chave calculada do agrupamento. Quando essas chaves divergem, um nome renomeado em um lugar não aparece no outro.

## O que será feito
1. Adicionar o botão "Renomear" (lápis) no cabeçalho da atividade aberta:
   - Área WEES (armário de RDOs), ao lado do título "OM 4502439978 — ...".
   - Portal do cliente, no mesmo ponto, para manter o padrão.
2. Usar sempre a mesma chave de grupo (a calculada pelo agrupamento por OM) e a mesma unidade nos três pontos de renomeação, para que o nome valha igual na WEES e no portal.
3. Após salvar, atualizar imediatamente o título na tela e as listas de pastas (mês, atividade e portal), sem precisar recarregar.
4. Mostrar mensagem clara de falha caso o salvamento seja recusado (hoje, em alguns casos, o diálogo apenas fecha sem aviso).

## Detalhes técnicos
- `src/components/reports/DocumentCabinet.tsx`: incluir botão de renomear no bloco do nível "atividade aberta" (`selectedProjectFolder`), reaproveitando `RenameActivityDialog` e `useActivityNames`, com `siteId = openSiteId` e `groupKey = selectedProjectFolder.id`.
- `src/pages/client/ClientActivityList.tsx`: derivar o `groupKey` do resultado de `buildActivityGroups` (mesma chave usada no `ClientDashboard`) em vez do `projectId` cru da URL, e aplicar `customNames` ao construir os grupos.
- `src/hooks/useActivityNames.ts`: propagar erro visível quando o `upsert` falhar e invalidar também as consultas de RDOs do portal/WEES.
- Nenhuma migração de banco é necessária.

## Verificação
1. Abrir a OM 4502439978 na área WEES, renomear e confirmar que o título muda na hora e na lista do mês.
2. Conferir o mesmo nome no portal do cliente (lista de atividades e página da atividade).
3. Testar "Nome automático" para restaurar o nome original.
