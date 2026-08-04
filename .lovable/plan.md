# Cliente troca a própria senha, sem confirmação por e-mail

Situação atual verificada: os acessos de cliente já são criados com o e-mail confirmado automaticamente (nenhum contato do portal está pendente de confirmação), então entrar não exige clicar em link de e-mail. A tela de Perfil do cliente já tem um bloco "Segurança" com troca de senha, mas ele fica no fim da página e o cliente que recebeu senha temporária não é avisado para trocá-la.

## O que muda

1. **Aviso de senha temporária após o login**
   - Ao entrar no portal, se a senha ainda for a temporária gerada pelo convite, exibir um banner/diálogo: "Defina sua senha de acesso" com atalho direto para a troca.
   - O cliente pode adiar, mas o aviso reaparece até definir a própria senha.

2. **Troca de senha mais visível e clara**
   - Botão "Alterar senha" no menu do usuário do portal (leva direto ao bloco Segurança do Perfil).
   - Bloco Segurança promovido para o topo do Perfil quando a senha ainda é temporária.
   - Mínimo alinhado em 8 caracteres (igual ao usado na geração de senhas) com indicação clara e confirmação.
   - Após salvar, a marcação de "senha temporária" é limpa e o aviso some.

3. **Entrada sem confirmação por e-mail (garantido)**
   - Todos os caminhos de criação/redefinição de acesso passam a marcar o e-mail como confirmado, inclusive o ramo de redefinição que hoje não faz isso, evitando qualquer bloqueio de "confirme seu e-mail".

## Detalhes técnicos

- Banco: coluna `must_change_password boolean default false` em `public.company_contacts` (e equivalente em `client_profiles`), marcada como `true` quando o convite/reset gera senha temporária e limpa quando o cliente troca a senha.
- Edge functions `send-client-invitation` e `set-client-password`: garantir `email_confirm: true` em todos os ramos de `updateUserById` e setar a flag de senha temporária.
- Front-end:
  - `src/pages/client/ClientProfile.tsx`: validação mínima de 8 caracteres, limpar a flag após `auth.updateUser`, destacar o bloco Segurança quando a flag estiver ativa.
  - `src/components/client/ClientLayout.tsx`: item "Alterar senha" no menu do usuário e banner de aviso quando a flag estiver ativa.
