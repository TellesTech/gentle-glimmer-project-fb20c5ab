# PIN próprio do cliente e assinatura salva automaticamente

Hoje o cliente até consegue entrar com PIN, mas só se alguém da WEES criar o PIN para ele (na tela "Membros da Unidade"). E a assinatura só fica salva se o cliente entrar no Perfil e cadastrá-la manualmente: quando ele desenha a assinatura na hora de assinar um RDO, ela é usada e descartada.

O plano resolve os dois pontos.

## 1. O cliente cria e gerencia o próprio PIN

- Novo bloco **"Acesso rápido (PIN)"** na página Perfil do cliente:
  - quando não há PIN: campo para definir um PIN de 4 dígitos com confirmação;
  - quando já existe: botões "Alterar PIN" e "Remover PIN";
  - aviso claro de que o PIN serve para entrar direto pela tela da unidade, sem senha nem e-mail.
- Atalho **"Acesso rápido"** no menu do usuário do portal, levando a esse bloco.
- O convite de primeiro acesso continua funcionando; o aviso para criar o PIN logo após o primeiro login permanece, com o texto apontando para o Perfil caso o cliente adie.

## 2. Assinatura registrada e reaproveitada

- Ao assinar um RDO desenhando/enviando a assinatura, aparece a opção **"Salvar esta assinatura para os próximos relatórios"**, marcada por padrão.
- Salvando, a assinatura vai para o perfil do cliente e, do próximo RDO em diante, ele vê o botão de assinar com um clique.
- No Perfil, o bloco de assinatura ganha o botão "Remover assinatura" e a indicação de quando ela foi registrada.
- Na tela de assinatura em lote, o texto passa a indicar quando a assinatura salva está sendo usada.

## Detalhes técnicos

- **Banco/edge function**: `set-pin` passa a aceitar `remove: true` (limpa `pin_hash`) e a resolver o `contactId` pelo usuário autenticado quando não for informado, para o cliente poder alterar o próprio PIN sem privilégio de admin. Validação de 4 dígitos mantida.
- **`src/pages/client/ClientProfile.tsx`**: novo card "Acesso rápido (PIN)" (definir/alterar/remover) usando `company_contacts` do usuário logado; botão de remover assinatura via `save-client-profile` com `signature_data: null`.
- **`src/pages/ClientReportView.tsx`**: após assinatura manual bem-sucedida, se o checkbox estiver marcado e não houver assinatura salva no perfil, chamar `save-client-profile` com o `signature_data` usado; invalidar as queries do relatório.
- **`src/components/signatures/OneClickSignatureCard.tsx`**: checkbox "Salvar esta assinatura" no modo manual, exposto ao chamador via callback (`onSign(signature, { save })`), sem alterar o comportamento para usuários WEES.
- **`src/components/client/ClientLayout.tsx`**: item de menu "Acesso rápido" apontando para `#pin` no Perfil; `FirstAccessPinDialog` mantém o comportamento atual.
- Nenhuma mudança no algoritmo de hash do PIN nem no fluxo de e-mail/senha existente.
