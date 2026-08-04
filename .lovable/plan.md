# E-mails de acesso enviados por portal@wees.com.br

Hoje os e-mails de primeiro acesso (link mágico) do portal saem pelo servidor padrão do Supabase: remetente genérico, sem a marca WEES e com limite baixo de envios por hora. O objetivo é enviar por `portal@wees.com.br`, via Resend, com um template com a identidade do portal.

Como este projeto usa uma instância própria do Supabase (não o Cloud gerenciado da Lovable), a troca do remetente acontece em duas frentes: configuração no painel (feita por você, com passo a passo) e template/redirecionamentos (feitos por mim).

## Etapa 1 — Verificar o domínio no Resend (você)

1. Criar conta em resend.com (plano gratuito cobre 3.000 e-mails/mês).
2. Domains -> Add Domain -> `wees.com.br`.
3. O Resend mostra registros DNS (MX/TXT de envio, TXT DKIM e TXT DMARC). Adicionar no provedor de DNS do domínio.
4. Aguardar o status ficar "Verified".
5. Criar uma API Key (Full access) e guardar.

Observação: o domínio de envio é `wees.com.br`; `rdo.wees.com.br` continua sendo apenas o endereço do site. Se preferir isolar o envio, dá para verificar `mail.wees.com.br` e usar `portal@mail.wees.com.br` — isso não afeta o site.

## Etapa 2 — SMTP no Supabase (você aplica, eu te guio)

No painel do Supabase do projeto, em Authentication -> Emails -> SMTP Settings, ativar "Enable Custom SMTP":

```text
Host:         smtp.resend.com
Port:         465
Username:     resend
Password:     <API Key do Resend>
Sender email: portal@wees.com.br
Sender name:  Portal WEES
```

Em Authentication -> Rate Limits, aumentar o limite de e-mails por hora (o padrão é baixo demais para convites em lote).

Sem essa etapa nada muda: o remetente é definido no servidor de autenticação, não no código do app.

## Etapa 3 — Template do e-mail de acesso (eu preparo)

Escrevo o HTML do e-mail de "Magic Link" com a identidade do portal — logo, cor vinho do portal, título "Seu acesso ao Portal WEES", botão de entrar, o código de 6 dígitos como alternativa e rodapé com aviso de expiração. Entrego o HTML pronto e onde colar (Authentication -> Emails -> Magic Link / Confirm signup), já que em instância própria os templates só são salvos pelo painel.

## Etapa 4 — Ajustes no app (eu faço)

- Conferir que `rdo.wees.com.br` e o domínio de preview estão nas Redirect URLs do Supabase, para o link do e-mail abrir o portal certo e não uma tela de erro.
- Ajustar a função `client-magic-link` para montar o `redirectTo` sempre no domínio oficial (`https://rdo.wees.com.br/...`) quando o convite for disparado do painel admin, evitando links apontando para o preview.
- Mensagem de erro mais clara no envio quando o limite do provedor for atingido.

## Detalhes técnicos

- Instância Supabase própria: alteração de configuração de auth e de templates por API não está disponível aqui; SMTP e templates são alterados no painel do Supabase.
- A infraestrutura de e-mails gerenciada da Lovable (fila, domínio de envio) exige Lovable Cloud e não se aplica a este projeto — por isso o caminho é Resend + SMTP nativo do Supabase.
- O envio continua passando pelo Supabase Auth (`signInWithOtp`), então link mágico e código OTP seguem funcionando como hoje; muda quem entrega o e-mail e como ele se parece.

## Resultado final

- E-mails de primeiro acesso saindo de `Portal WEES <portal@wees.com.br>`.
- Template com a marca do portal, botão de acesso e código de 6 dígitos.
- Links abrindo em `rdo.wees.com.br` e limite de envio compatível com convites em lote.