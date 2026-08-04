# Pastas ocultas nas métricas + header limitado para o cliente

## 1. Métricas respeitam as pastas ocultas
Hoje as contagens do topo (RDOS / ASSINADOS / PENDENTES, gráfico e lista de pendentes) somam todos os relatórios, mesmo quando o mês foi ocultado pelo super admin. Resultado: a pasta some, mas o número continua igual.

Mudança:
- Criar uma lista de relatórios "visíveis" = todos os relatórios menos os que caem em um mês oculto.
- Para o cliente: métricas, gráfico e lista de pendentes usam apenas os relatórios visíveis, então ao ocultar Janeiro os números caem.
- Para o super admin: como ele ainda enxerga as pastas ocultas (esmaecidas, com selo "Oculto"), os números continuam contando tudo, para ele saber o total real.

## 2. Header do portal: cliente vê só Dashboard e Meu Perfil
Os botões "Convite", "Área WEES" e o item "Membros da Unidade" devem aparecer somente para usuários internos WEES.

Mudança:
- Endurecer a regra de "usuário interno": só quando não há perfil de cliente/contato ativo E o papel é `super_admin` ou `admin` da WEES; qualquer sessão aberta como cliente/contato (inclusive quando entra pelo link do portal com `portal_user`) passa a ser tratada como cliente.
- Nesse caso o menu fica apenas com Dashboard e Meu Perfil, e a área direita mostra só nome, tema e sair.

## Detalhes técnicos
- `src/pages/client/ClientDashboard.tsx`: derivar `visibleReports` filtrando por `hiddenMonthKeys` (chave `year-month` da data do relatório) e usar em `metrics`, `chartData` e `pendingList`; manter o conjunto completo quando `isSuperAdmin`.
- `src/components/client/ClientLayout.tsx`: ajustar `isInternalUser` para excluir sessões de cliente/contato (checar `clientProfile`, `role === 'client'`/`collaborator` e o parâmetro `portal_user`), que já controla `navItems`, o botão Convite e o botão Área WEES.
