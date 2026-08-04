# Acesso manual por e-mail e senha em "Membros da Unidade"

Enquanto o envio de e-mail (Resend) não estiver ativo, o acesso do cliente passa a ser criado 100% manualmente: você define o e-mail e a senha do contato na própria tela de Membros da Unidade e repassa como preferir (WhatsApp, presencialmente etc.). O login por link mágico continua exatamente como está hoje.

## O que muda na tela

Formulário de novo contato (e edição de contato existente):
- Novo campo **Senha de acesso**, com botão "Gerar senha" (sugestão automática) e opção de mostrar/ocultar.
- Botão **Copiar credenciais**: copia e-mail + senha + link do portal para colar no WhatsApp.
- Regra: senha mínima de 8 caracteres. Se ficar em branco na criação, o sistema gera uma automaticamente e mostra qual foi (comportamento atual, mas agora visível).
- O PIN de 4 dígitos continua obrigatório como hoje — a senha é um caminho adicional de entrada.

Em contatos já existentes:
- Nova ação **Definir/Redefinir senha** no card do contato, que grava a senha imediatamente no acesso do cliente e mostra a confirmação com a senha definida para você copiar.

## Detalhes técnicos

- `supabase/functions/register-client-contact/index.ts`: aceitar `password` opcional no corpo da requisição; usar essa senha em `auth.admin.createUser` em vez da senha gerada; quando o usuário já existir, aplicar `auth.admin.updateUserById` com a nova senha. Validar tamanho mínimo e devolver a senha efetiva na resposta.
- Nova função de borda `set-client-password` (service role, restrita a `super_admin`/`admin` autenticado) para redefinir a senha de um contato já provisionado, validando que o contato pertence à empresa informada.
- `src/components/settings/ClientContactsSection.tsx`: adicionar o campo de senha no estado `newContact` e no estado de edição, o gerador de senha, o botão de copiar credenciais e a ação de redefinir senha; incluir a senha no texto de convite já existente.
- Sem alterações de banco de dados: a senha vive apenas no Supabase Auth, nunca é gravada em tabela.
- Login do cliente (`ClientLogin.tsx`) permanece inalterado (PIN, e-mail+senha e link mágico seguem disponíveis).

## Fora do escopo

- Configuração de Resend/SMTP e DNS de `send.wees.com.br` ficam pausadas; a documentação em `docs/email-templates/` permanece para quando você quiser retomar.
