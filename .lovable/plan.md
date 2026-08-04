# Convite sempre com link + senha temporária

Hoje, quando o contato já existe, o convite mantém a senha antiga e a mensagem sai sem senha (só o link). Você quer que a mensagem sempre traga o link e uma senha temporária de acesso.

## O que muda

1. **Gerar convite sempre cria senha temporária**
   - Ao clicar em "Gerar texto de convite", o sistema gera uma nova senha temporária para o contato (mesmo se ele já tinha acesso) e a exibe no diálogo.
   - Aviso claro no diálogo: "Senha temporária — a senha anterior deixou de funcionar".

2. **Mensagem de WhatsApp padronizada**
   - O bloco de acesso passa a ter sempre:
     - E-mail
     - Senha temporária
     - Link direto de e-mail/senha
   - Texto indicando que é uma senha temporária e que pode ser alterada depois no perfil.
   - PIN continua opcional (só entra no texto se existir).

3. **Diálogo "Convite Gerado"**
   - Remove o bloco "a senha atual foi mantida"; o botão "Redefinir senha" continua disponível para gerar outra senha caso necessário.

## Detalhes técnicos

- `src/components/.../ClientContactsSection.tsx`: enviar `resetPassword: true` na chamada de `send-client-invitation` no fluxo "Gerar texto de convite"; ajustar `getWhatsAppMessage()` para rotular "Senha temporária" e sempre incluir link; ajustar `renderCredentialsBody()` (rótulo e aviso).
- `supabase/functions/send-client-invitation/index.ts`: nenhuma mudança de contrato necessária — já retorna `password` quando `resetPassword` é verdadeiro. Somente verificação de que a senha volta sempre preenchida nesse fluxo.
