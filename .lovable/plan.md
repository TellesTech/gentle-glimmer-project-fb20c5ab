# Ocultar e remover RDOs e pastas na área do cliente

Hoje só o super admin consegue ocultar pastas de mês, e isso só funciona no painel principal do portal. A lista de atividades (`ClientActivityList`) e a lista de RDOs (`ClientReports`) não respeitam nenhuma ocultação, e não existe forma de esconder um RDO específico.

## O que muda

1. **Ocultar RDO individual**: cada folha de RDO na área do cliente ganha um menu (só para WEES) com "Ocultar do portal". O RDO some para o cliente e fica esmaecido com o selo "Oculto" para a WEES, com opção de reexibir.
2. **Remover do portal (definitivo)**: no mesmo menu, "Remover do portal". O RDO (ou a pasta de mês) sai da área do cliente de forma definitiva; continua existindo normalmente na área WEES. Pede confirmação antes.
3. **Pastas de mês**: continuam com o botão de olho, agora também com a opção de remover definitivamente.
4. **Quem pode**: super admin e admin da WEES. Cliente nunca vê os botões (bloqueio também no banco).
5. **Vale em todos os lugares da área do cliente**: painel, cards de atividade, lista de RDOs da atividade, contagens do topo, gráfico, lista de pendentes e download em lote. Um RDO oculto/removido também não abre por link direto para o cliente.

## Detalhes técnicos

Banco (migração):
- Nova tabela `public.portal_hidden_reports` (`report_id`, `company_id`, `site_id`, `mode` = `hidden` | `removed`, `hidden_by`, `created_at`, único por `report_id`).
- Coluna `mode` em `portal_hidden_months` (default `hidden`) para o mesmo comportamento nas pastas.
- GRANTs: `SELECT/INSERT/UPDATE/DELETE` para `authenticated`, `ALL` para `service_role`.
- RLS: leitura para autenticados; escrita apenas quando `is_super_admin(auth.uid())` ou `has_role(auth.uid(),'admin')`.
- Atualizar `public.can_view_portal_report` e `get_portal_visible_report_ids` para excluir os relatórios listados em `portal_hidden_reports` e os meses ocultos quando o usuário não for interno.

Frontend:
- Hook compartilhado `usePortalHidden(companyId, siteId)` com os conjuntos de meses e relatórios ocultos/removidos e as mutations (ocultar, reexibir, remover), invalidando as queries do portal.
- `src/pages/client/ClientDashboard.tsx`: usar o hook no lugar da query local, aplicar o filtro de RDOs ocultos em `visibleReports`, métricas, gráfico, pendentes e download em lote; adicionar o menu nas folhas de RDO e a opção de remover no card de mês.
- `src/pages/client/ClientActivityList.tsx` e `src/pages/client/ClientReports.tsx`: filtrar `reportIds` pelos ocultos/removidos para não-internos e mostrar o menu/selo para WEES.
- `src/pages/ClientReportView.tsx`: bloquear a abertura para cliente quando o RDO estiver oculto/removido.
- Permissão em todos os pontos: `role === 'super_admin' || role === 'admin'`, desativada no modo de pré-visualização de cliente.

## Fora do escopo
- Excluir o RDO do sistema (a remoção é só do portal do cliente).
- Ocultar pastas de atividade ou de ano.
