# Primeiro acesso do cliente por e-mail (link mágico)

Hoje o portal só oferece PIN de 4 dígitos ou e-mail + senha. O cliente que nunca acessou precisa esperar alguém gerar um convite manualmente. A mudança cria um caminho de primeiro acesso sem senha: o cliente informa o e-mail, recebe um link/código e entra direto.

## Como vai funcionar

1. Na tela de login da unidade (ex.: `/suzano/aracruz`), abaixo do acesso por PIN, entra a opção **Entrar com e-mail**.
2. O cliente digita o e-mail. Se esse e-mail estiver cadastrado como contato ativo daquela empresa/unidade, o sistema envia um link mágico (com código de 6 dígitos como alternativa).
3. Ao clicar no link (ou digitar o código), ele entra no portal já autenticado, sem senha.
4. No primeiro login, o portal pede que ele **defina um PIN de 4 dígitos** para os próximos acessos (pula quem já tem PIN).
5. E-mails não cadastrados recebem sempre a mesma mensagem neutra ("se este e-mail estiver cadastrado, enviamos o acesso"), para não revelar quem é cliente.

## Envio automático ao cadastrar

Ao cadastrar um novo contato da unidade, o convite de primeiro acesso é enviado por e-mail automaticamente, sem precisar clicar em "Gerar convite". O botão continua existindo para reenvio.

## Detalhes técnicos

- **Nova edge function `client-magic-link`** (service role):
  - valida o e-mail, confirma que existe contato ativo em `company_contacts` vinculado à empresa/unidade (via `contact_sites`);
  - cria o usuário de auth se ainda não existir e grava `company_contacts.user_id`;
  - gera o link com `auth.admin.generateLink` (tipo `magiclink`), com redirect para `/{empresa}/{unidade}?first_access=1`;
  - envia o e-mail. Como este projeto usa Supabase próprio (o envio gerenciado da Lovable não está disponível aqui), o disparo usa o e-mail nativo do Supabase Auth via `signInWithOtp`; se você preferir um layout com a marca WEES, dá para trocar depois por um provedor (ex.: Resend) com chave sua.
  - resposta sempre genérica (200) para não vazar cadastro.
- **`ClientLogin.tsx`**: novo modo `magic` — campo de e-mail, botão "Enviar acesso", estado de "verifique seu e-mail" com campo para o código de 6 dígitos (`verifyOtp`), cooldown de 60s no reenvio e o texto neutro de retorno.
- **Primeiro acesso**: ao voltar autenticado com `first_access=1` (ou quando o contato está sem `pin_hash`), abre o diálogo de definição de PIN reaproveitando a edge function `set-pin`; depois segue para o dashboard.
- **Cadastro de contato**: no ponto onde o contato é criado (tela Membros da Unidade), chamar `client-magic-link` logo após o insert, e manter "Gerar convite" como reenvio manual.
- Nada muda no fluxo de PIN nem no login por e-mail e senha já existentes.
