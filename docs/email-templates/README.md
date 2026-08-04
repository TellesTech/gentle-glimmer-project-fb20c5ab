# E-mails de acesso do portal — envio por portal@wees.com.br

Os e-mails de primeiro acesso (link mágico + código de 6 dígitos) são enviados pelo
Supabase Auth. Para que saiam de `Portal WEES <portal@wees.com.br>` com a identidade
do portal, é necessário configurar SMTP e template no painel do Supabase.

## 1. Resend (verificar o domínio)

1. Criar conta em https://resend.com (grátis até 3.000 e-mails/mês).
2. **Domains → Add Domain →** `wees.com.br`.
3. Copiar os registros DNS exibidos (MX/TXT de envio, TXT DKIM, TXT DMARC) para o
   provedor de DNS de `wees.com.br`.
4. Aguardar o status ficar **Verified**.
5. **API Keys → Create API Key** (Full access) e guardar o valor.

> `rdo.wees.com.br` continua sendo apenas o endereço do site — os registros de e-mail
> ficam no domínio raiz e não afetam o portal.

## 2. SMTP no Supabase

Painel do Supabase → **Authentication → Emails → SMTP Settings** → *Enable Custom SMTP*:

```
Host:         smtp.resend.com
Port:         465
Username:     resend
Password:     <API Key do Resend>
Sender email: portal@wees.com.br
Sender name:  Portal WEES
```

Em **Authentication → Rate Limits**, subir "Emails per hour" (o padrão é baixo demais
para convites em lote).

## 3. Template

**Authentication → Emails → Magic Link** → colar o conteúdo de
[`supabase-magic-link.html`](./supabase-magic-link.html) e salvar.
Opcionalmente repetir em **Confirm signup** para manter o mesmo visual.

## 4. Redirect URLs

**Authentication → URL Configuration**:

- Site URL: `https://rdo.wees.com.br`
- Redirect URLs (adicionar todas):
  - `https://rdo.wees.com.br/**`
  - `https://gentle-glimmer-project.lovable.app/**`
  - `http://localhost:8080/**`

A edge function `client-magic-link` já normaliza o `redirectTo` para
`https://rdo.wees.com.br` (exceto em localhost), então o link do e-mail sempre abre o
domínio oficial mesmo quando o convite é disparado do preview.