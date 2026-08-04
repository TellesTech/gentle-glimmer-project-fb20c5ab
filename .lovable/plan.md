# Restaurar acesso WEES no portal do cliente

## Problema
No cabeçalho do portal (`/client/dashboard`) você, como super admin, não vê mais os botões **Convite**, **Área WEES** nem **Membros da Unidade**. A regra criada na alteração anterior classifica a sessão como "cliente" quando existe qualquer vínculo de cliente para o usuário logado (perfil de cliente, sessão de portal ou papel colaborador) — e essa condição está engolindo o super admin, mesmo sem o parâmetro de simulação na URL.

## Correção
1. **Prioridade do papel interno**: em `ClientLayout`, super admin/admin autenticados na área WEES passam a ser sempre tratados como internos. A classificação de "cliente" só se aplica quando:
   - não há usuário interno autenticado, ou
   - o modo de simulação está ativo (`?view=client` ou `?portal_user=...`).
2. **Botão de simulação no portal**: adicionar no cabeçalho, apenas para internos, um toggle **Ver como cliente** / **Voltar à visão WEES**, que liga e desliga `?view=client` na mesma tela. Nesse modo os botões internos ficam ocultos (mostrando exatamente o que o cliente vê), com exceção do próprio botão de voltar à visão WEES.
3. **Coerência com as métricas e pastas ocultas**: no dashboard, quando o modo cliente estiver ativo, as métricas e as pastas de meses ocultos passam a seguir a regra do cliente (meses ocultos não aparecem e não contam). Fora do modo cliente, o super admin continua vendo tudo, com as pastas ocultas em estado esmaecido e o ícone de olho para alternar.

## Detalhes técnicos
- `src/components/client/ClientLayout.tsx`: reescrever o cálculo de `isClientSession` / `isInternalUser` conforme acima e renderizar o toggle usando o hook existente `useClientPreviewMode`.
- `src/pages/client/ClientDashboard.tsx`: usar `useClientPreviewMode` como parte da condição que hoje decide entre "visão super admin" e "visão cliente" para métricas e meses ocultos.
- Sem alterações de banco de dados nem de RLS.
