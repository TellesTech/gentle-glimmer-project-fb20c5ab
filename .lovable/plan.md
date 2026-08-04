# Mostrar apenas os membros designados para assinatura

## Situação atual (confirmada no banco)

O card "Equipe WEES" do portal lista **25 pessoas** — todos os usuários com acesso às obras da unidade (soldadores, pintores, caldeireiros etc.), não os signatários. Na prática, nessa empresa:

- apenas **2 colaboradores WEES têm assinatura cadastrada**;
- os RDOs da unidade têm **6 nomes distintos** que realmente assinaram.

Por isso a lista aparece poluída e com dezenas de "Sem assinatura".

## O que será feito

1. O card "Equipe WEES" passa a mostrar somente quem é signatário: colaborador com assinatura cadastrada no perfil **ou** que já consta como signatário em algum RDO da unidade.
2. Mesma regra no card da equipe do cliente: só contatos/usuários do cliente com assinatura cadastrada ou que já assinaram/foram designados como aprovadores de RDOs.
3. O contador ao lado do título passa a refletir esse total reduzido (ex.: 25 -> poucos nomes), e o nome exibido no card fechado continua sendo o do responsável principal.
4. Se nenhum signatário estiver configurado, o card mostra a mensagem de vazio já existente, em vez de listar a equipe inteira.

## Detalhes técnicos

- Migração ajustando `public.get_portal_wees_responsibles(_company_id)`: manter as mesmas checagens de permissão, mas filtrar o resultado para perfis com `signature_data IS NOT NULL` ou presentes em `report_signatures` (por `signer_user_id`, ou por nome normalizado) de RDOs da empresa.
- `src/hooks/usePortalResponsibles.ts`: no lado cliente, restringir `company_contacts`/`client_profiles` a quem tem `signature_data` ou aparece em `report_company_approvers` / `report_client_approvers` / `report_signatures` dos RDOs da empresa.
- `src/components/client/PortalResponsiblesCard.tsx`: nenhuma mudança estrutural; apenas se beneficia das listas filtradas (contador e resumo já derivam dos dados).
