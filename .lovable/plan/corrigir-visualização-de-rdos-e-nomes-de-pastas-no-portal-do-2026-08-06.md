# Corrigir visualização de RDOs e nomes de pastas no portal do cliente

## Problema (confirmado no código e imagem)
O usuário relatou que os RDOs sumiram da área de assinatura e os nomes das pastas estão errados.
Analisando o código:
1.  **Nomes das pastas**: O `ClientDashboard` agora utiliza `buildActivityGroups` para agrupar RDOs por OM/Título. Se os nomes estão errados, pode ser porque os dados de OM (`maintenance_order_number`, `maintenance_order_title`) não estão sendo preenchidos corretamente nos RDOs ou o agrupamento está falhando em identificar a atividade correta.
2.  **RDOs sumiram**: Na tela `ClientActivityList`, a query `activityInfo` tenta reconstruir os grupos de atividades para todo o site para encontrar o grupo correspondente ao `projectId` (que agora é um ID de grupo). No entanto, a chamada RPC `portal_user_site_ids` pode estar falhando ou retornando um escopo diferente do que o usuário espera, resultando em `reports.length === 0`.
3.  **Contexto do `projectId`**: O `projectId` na URL agora é um ID de grupo (ex: `om:123`, `title:abc`). Se o usuário navega para uma atividade e os relatórios não aparecem, a lógica de filtragem por `reportIds` no `ClientActivityList` deve ser validada.

## Plano de Ação
1.  **Ajustar `ClientActivityList`**: Garantir que a query de `activityInfo` considere o escopo correto do usuário (Admin vs Cliente) e que o fallback para UUID de projeto funcione se o ID do grupo não for encontrado.
2.  **Melhorar tratamento de IDs de Grupo**: No `ClientDashboard`, garantir que o ID passado para a rota de atividade seja consistente com o que o `ClientActivityList` espera.
3.  **Verificar Visibilidade**: Garantir que RDOs com status `sent`, `signed` ou `finalized` sejam sempre incluídos no agrupamento, respeitando o vínculo de site.

## Detalhes técnicos
- Revisar `src/pages/client/ClientActivityList.tsx`: a query `activityInfo` usa `(supabase as any).auth?.user?.id` que pode estar indefinido dependendo do contexto. Mudar para usar o `user.id` do hook `useAuth`.
- Adicionar logs defensivos para diagnosticar se o `buildActivityGroups` está encontrando os relatórios esperados.
- Validar se o `ClientDashboard` está gerando IDs de grupo estáveis para navegação.

## Verificação
- Abrir o portal como cliente e verificar se as pastas de meses mostram as atividades com nomes de OM corretos.
- Clicar em uma atividade e garantir que os cartões de RDO (folhas) apareçam corretamente.
