# Reduzir a lista "Equipe WEES" aos signatários reais

Hoje o card mostra 25 pessoas porque a lista traz **todo mundo com acesso às obras da empresa** (administradores do portal + responsáveis de site), e não quem realmente assina os RDOs.

Dados confirmados para esta unidade (Suzano / site atual):
- 25 pessoas com acesso
- 2 com assinatura cadastrada no perfil
- 1 que efetivamente já assinou algum RDO

## O que muda

1. **Filtro na origem dos dados**: a função do banco `get_portal_wees_responsibles` passa a retornar apenas pessoas que:
   - possuem assinatura cadastrada no perfil, **ou**
   - já assinaram (ou foram designadas para assinar) algum RDO da empresa.
2. **Card "Equipe WEES"**: o contador (25) passa a refletir a lista filtrada, e o nome exibido no cabeçalho continua sendo o primeiro signatário.
3. **Equipe Cliente**: mesmo critério — apenas contatos aprovadores/signatários, para manter a simetria entre os dois cards.
4. **Fallback**: se nenhum signatário for encontrado, o card exibe uma mensagem discreta ("Nenhum responsável por assinatura definido") em vez de listar todos.

## Detalhes técnicos

- Migração: `CREATE OR REPLACE FUNCTION public.get_portal_wees_responsibles` mantendo a checagem de permissão atual e acrescentando o filtro por `profiles.signature_data IS NOT NULL OR EXISTS (report_signatures.signer_user_id = p.id)` restrito aos relatórios da empresa.
- `src/hooks/usePortalResponsibles.ts`: filtrar a lista de clientes por `signature_data` ou `can_approve`.
- `src/components/client/PortalResponsiblesCard.tsx`: usar o comprimento da lista filtrada no badge e tratar o estado vazio.
