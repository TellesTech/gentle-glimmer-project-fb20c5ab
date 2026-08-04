# Corrigir a senha no convite do cliente

## O que está acontecendo

A senha `Suzano@8870` não foi a que você definiu. Ao clicar em "Gerar texto de convite", a função `send-client-invitation` **sempre gera uma senha nova** a partir do nome da empresa (`Suzano` + 4 dígitos) e a aplica no usuário via Auth Admin (visto nos logs: `PUT /admin/users` às 17:38). Ou seja, o convite sobrescreve silenciosamente a senha manual que você tinha cadastrado em "Membros da Unidade".

## O que será feito

1. **Gerar convite deixa de trocar a senha.**
   - Se o contato já tem usuário de autenticação, o convite apenas monta o texto e os links — nenhuma redefinição de senha acontece.
   - Se o contato ainda não tem usuário, aí sim o acesso é criado com uma senha nova (gerada a partir do nome da pessoa, não da empresa) e ela aparece no convite.

2. **A senha definida manualmente passa a ser reaproveitada no convite.**
   - A última senha definida pelo admin (no formulário de criação/edição ou no ícone de chave) fica guardada para exibição no card e no texto de convite, para que o convite mostre exatamente a senha que você definiu.

3. **Redefinição vira ação explícita.**
   - No diálogo do convite haverá um botão "Redefinir senha" para quando você realmente quiser trocar; sem clicar nele, a senha atual do cliente permanece intacta.
   - Se nenhuma senha for conhecida (contato antigo, senha nunca registrada pelo painel), o convite mostra um aviso com o botão de redefinir em vez de inventar uma senha.

4. **Correção imediata para o Lucas Rosa.**
   - Redefinir a senha dele para a que você quer usar e gerar o convite novamente já com o texto correto.

## Detalhes técnicos

- `supabase/functions/send-client-invitation/index.ts`: remover o reset incondicional em `provisionAuthUser`; só criar usuário quando não existir; aceitar `resetPassword: boolean` opcional; retornar `password` apenas quando de fato foi definida nesta chamada.
- Guardar a senha exibível do contato (definida via `set-client-password` / `register-client-contact`) para uso no convite — armazenada no navegador do admin junto com os PINs (`client_contact_pins_v1`), sem gravar senha em texto no banco.
- `src/components/settings/ClientContactsSection.tsx`: parar de chamar `set-client-password` automaticamente dentro de `handleGenerateInvite`; usar a senha conhecida; adicionar botão "Redefinir senha" no diálogo de credenciais; ajustar `getWhatsAppMessage` para omitir o bloco de senha quando ela não for conhecida.
