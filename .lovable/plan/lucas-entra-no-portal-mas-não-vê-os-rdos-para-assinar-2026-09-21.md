# Lucas entra no portal mas não vê os RDOs para assinar

## Causa confirmada

O Lucas tem, por engano, **dois cadastros ligados ao mesmo login**:

- um em "contatos da empresa" (Lucas Rosa) — é esse que a WEES usa ao escolher quem assina, e nele estão os **51 RDOs** indicados para ele;
- outro em "perfis de cliente" (Lucas Matos Rosa), criado em 03/08, sem nenhum RDO vinculado.

Ao entrar, a área do cliente procura primeiro o perfil de cliente e para nele. Como esse cadastro não tem nenhum RDO indicado, a tela fica vazia — sem erro, exatamente como ele relatou.

Verificado no banco: a permissão de leitura dos RDOs funciona (o relatório de 17/09 é visível para o login dele), a unidade Suzano Aracruz está vinculada, a conta está ativa, com PIN, e o último acesso foi em 18/09. Ele é o único usuário do sistema com os dois cadastros duplicados.

## O que será feito

1. **Corrigir a escolha do cadastro no acesso ao portal**: quando o mesmo login tiver os dois registros, dar prioridade ao cadastro de contato da empresa, que é o usado pela WEES para indicar signatários. Isso resolve o caso do Lucas e evita o mesmo problema com qualquer pessoa cadastrada em duplicidade no futuro.
2. **Manter o comportamento atual** para quem tem apenas um dos dois cadastros.
3. **Limpeza opcional** do perfil de cliente duplicado do Lucas — só faço se você confirmar; a correção acima já resolve sem apagar nada.

## Verificação

- Conferir que os 51 RDOs indicados ao Lucas passam a aparecer, incluindo os 10 pendentes de assinatura (08/09 a 17/09).
- Conferir que outro cliente que usa apenas o perfil de cliente continua vendo seus RDOs normalmente.

## Detalhes técnicos

`src/contexts/ClientAuthContext.tsx` → `fetchClientProfile`: consultar `company_contacts` e `client_profiles` em paralelo e priorizar `company_contacts` (`_source = 'company_contacts'`) quando ambos existirem, mantendo `client_profiles` como fallback. Nenhuma migração de banco necessária; `can_view_portal_report` e `portal_user_site_ids` já retornam corretamente para esse usuário.
