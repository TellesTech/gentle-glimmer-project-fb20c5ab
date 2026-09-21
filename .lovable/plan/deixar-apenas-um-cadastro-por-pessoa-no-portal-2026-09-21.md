# Deixar apenas um cadastro por pessoa no portal

Sim — o ideal é uma pessoa, um cadastro. Hoje o Lucas é o único com dois, e o duplicado não tem nada de útil ligado a ele.

## Situação verificada

O cadastro duplicado do Lucas em "perfis de cliente" tem:
- 0 RDOs indicados para assinatura
- 1 vínculo de unidade, 1 vínculo de empresa e 1 papel de acesso (todos repetindo o que já existe no cadastro de contato da empresa)

Tudo que importa — os 51 RDOs, as assinaturas já feitas, o PIN e a unidade Suzano Aracruz — está no cadastro de contato da empresa, que permanece.

## O que será feito

1. **Remover o cadastro duplicado do Lucas** em "perfis de cliente", junto com os três vínculos vazios acima. O login, o PIN e o histórico de assinaturas não são tocados.
2. **Evitar novas duplicidades**: ao criar um acesso de cliente, o sistema passa a avisar quando aquele e-mail já tem cadastro no outro formato, em vez de criar um segundo silenciosamente.
3. **Manter a prioridade já aplicada** (contato da empresa na frente), como rede de segurança caso algum cadastro antigo ainda esteja duplicado.

## Verificação

- Entrar como Lucas e confirmar que os RDOs continuam aparecendo, com os pendentes de assinatura.
- Conferir que nenhum outro usuário ficou com dois cadastros.

## Detalhes técnicos

Migração pontual removendo a linha de `client_profiles` do Lucas e as linhas dependentes em `client_sites`, `client_companies` e `client_user_roles` (nenhuma em `report_client_approvers`). Nas telas/funções de criação de acesso de cliente (`create-client-admin`, `register-client-contact`), verificar e-mail existente na tabela oposta antes de inserir e retornar mensagem clara. A prioridade em `ClientAuthContext.fetchClientProfile` permanece como está.
