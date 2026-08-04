# Acesso por e-mail como principal + senha real no convite

## O que foi verificado

- O contato Lucas Rosa **tem PIN cadastrado**, por isso a tela de login ainda abre no card "Acesso Rápido" (a regra atual mostra o PIN sempre que existe um contato com PIN).
- A senha do convite (`Suzano@3134`) **é real** — ela é gravada no Auth pela função de convite. O problema é que ela é **gerada aleatoriamente a cada convite** e **sobrescreve** a senha que o administrador definiu manualmente. Ou seja: toda vez que você gera o convite, a senha antiga deixa de funcionar.

## O que será feito

### 1. E-mail como acesso principal
- A tela de login sempre abre no formulário de **e-mail e senha**, mesmo quando existem contatos com PIN.
- O PIN vira acesso secundário: um link discreto "Entrar com PIN de 4 dígitos" abaixo do formulário, exibido apenas quando algum contato daquela unidade já criou PIN.
- Links de convite com `?mode=pin` continuam abrindo direto na tela de PIN.

### 2. Senha do convite deixa de ser trocada sozinha
- Ao gerar o convite de um contato que **já tem acesso**, a senha existente é mantida e nada é sobrescrito.
- A senha só é gerada automaticamente quando o usuário de acesso é criado pela primeira vez.
- No diálogo "Convite Gerado", quando a senha atual não pode ser exibida (por já existir e ser conhecida só pelo cliente/administrador), o campo mostra a senha definida manualmente pelo admin, se houver; caso contrário, um botão **"Redefinir senha"** gera uma nova na hora e a insere no texto do convite.
- O texto do WhatsApp só inclui a linha de senha quando há uma senha para informar.

## Detalhes técnicos

- `src/pages/ClientLogin.tsx`: modo inicial fixo em `email` (exceto quando a URL traz `mode`); card "Acesso Rápido" só acessível via botão secundário condicionado a `contacts.some(c => c.has_pin)`.
- `supabase/functions/send-client-invitation/index.ts`: novo parâmetro `resetPassword?: boolean`. `provisionAuthUser` só chama `updateUserById({ password })` quando o usuário é novo ou quando `resetPassword === true`; retorna `password: null` nos demais casos.
- `src/components/settings/ClientContactsSection.tsx`: reaproveita a senha manual salva no formulário; adiciona botão "Redefinir senha" no diálogo do convite (chama a função com `resetPassword: true`) e monta a mensagem sem a linha de senha quando ela não existe.
