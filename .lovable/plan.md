# João não vê os RDOs de assinatura na Área do Cliente

## Diagnóstico (confirmado no banco)

O acesso do João está correto — o problema é o redirecionamento depois do login.

- Ele é contato de portal (`company_contacts`, e-mail `joao.santos.js5@suzano.com.br`), ativo, vinculado à unidade **Suzano Aracruz**.
- Pelas regras do banco, ele já pode ver **56 RDOs** dessa unidade, incluindo os **8 RDOs enviados para a assinatura dele** (datas de 17 a 21/08, todos pendentes).
- Porém, ao criar o login, o sistema também gerou automaticamente um cadastro interno para ele em `profiles` com o papel `collaborator` (sem empresa vinculada).
- O resolvedor pós-login (`src/pages/Login.tsx`) verifica primeiro se existe cadastro interno. Como existe, ele manda o João para a área WEES (`/home` → `/reports`), que fica vazia para ele. Ele nunca chega em `/client/dashboard`, onde os RDOs de assinatura aparecem.

Ou seja: os RDOs existem e estão liberados; ele está sendo jogado na tela errada.

## Correção

1. **Redirecionamento pós-login**: passar a considerar também `company_contacts` na resolução do destino. Se o usuário for contato/cliente de portal e não tiver papel interno efetivo (sem empresa em `profiles` e papel apenas `collaborator`), ele vai direto para `/client/dashboard`.
2. **Rede de segurança no `/home`**: se o usuário cair no `HomeRedirect` sem unidade/empresa interna mas tiver acesso de portal, redirecionar para a Área do Cliente em vez de mostrar tela vazia.
3. **Atalho manual**: manter um caminho de acesso claro (link "Área do Cliente") para quem tem os dois perfis, para não travar ninguém.
4. **Verificação**: confirmar com o usuário do João que, ao entrar, ele cai na Área do Cliente e vê os 8 RDOs pendentes de assinatura de Suzano Aracruz.

## Detalhes técnicos

- `src/pages/Login.tsx` → `resolvePostLoginDestination`: consultar em paralelo `profiles` (com `company_id`), `user_roles`, `client_profiles` e `company_contacts` (por `user_id`, ativo). Ordem de decisão: `super_admin`/`admin` → `/super-admin`; papel interno real (com `company_id` ou papel acima de `collaborator`) → `/home`; portal (contact/client) → `/client/dashboard`; senão `/home`.
- `src/components/HomeRedirect.tsx`: no ramo final (`role` colaborador sem unidade), checar acesso de portal via `company_contacts`/`client_profiles` e redirecionar para `/client/dashboard`.
- Sem mudança de banco: as políticas RLS e `can_view_portal_report` já liberam corretamente os RDOs `sent`/`signed`/`finalized` das unidades do contato, respeitando os meses ocultados.
