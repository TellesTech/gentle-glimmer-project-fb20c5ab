# E-mails de acesso do portal — envio por portal@wees.com.br

Os e-mails de primeiro acesso (link mágico + código de 6 dígitos) são enviados pelo
Supabase Auth. Para que saiam de `Portal WEES <portal@wees.com.br>` com a identidade
do portal, é necessário configurar SMTP e template no painel do Supabase.

## 1. Resend (verificar o domínio)

> Passo a passo detalhado dos registros no Cloudflare: [`dns-send-wees.md`](./dns-send-wees.md).
> Verificação automática: `./scripts/check-send-dns.sh`.

> A API Key do Resend conectada a este workspace é **restrita a envio** (`restricted_api_key`),
> então o domínio **não pode** ser criado/verificado por API — é preciso fazer no painel.

1. Acessar https://resend.com → **Domains → Add Domain**.
2. Usar o subdomínio **`send.wees.com.br`** (região `sa-east-1` ou `us-east-1`).
   Motivo: o domínio raiz `wees.com.br` já usa **Zoho Mail** (MX `mx.zoho.com`,
   SPF `include:zohomail.com`). O Resend pede um MX próprio de envio — colocá-lo na
   raiz quebraria o e-mail corporativo. Um subdomínio isola o envio transacional.
3. Adicionar no Cloudflare (DNS de `wees.com.br`) os registros mostrados pelo Resend,
   todos com proxy **DNS only**:
   - `MX  send  →  feedback-smtp.<região>.amazonses.com` (prioridade 10)
   - `TXT send  →  v=spf1 include:amazonses.com ~all`
   - `TXT resend._domainkey.send  →  p=<chave DKIM do painel>`
4. Aguardar o status ficar **Verified** (minutos até algumas horas).
5. **API Keys → Create API Key** com permissão **Full access** (a atual só envia) e guardar.

### Estado atual do DNS (verificado)

| Registro | Situação |
| --- | --- |
| `wees.com.br` MX | Zoho (`mx.zoho.com`, `mx2`, `mx3`) — **não mexer** |
| `wees.com.br` SPF | `v=spf1 include:zohomail.com include:_spf.mail.hostinger.com ~all` |
| `_dmarc.wees.com.br` | `v=DMARC1; p=quarantine; ... adkim=r; aspf=r` — já existe, cobre subdomínios |
| `resend._domainkey.wees.com.br` | **ausente** |
| `send.wees.com.br` | **ausente** — criar |

O DMARC está em modo relaxado (`adkim=r`), então o DKIM de `send.wees.com.br` alinha
corretamente. Nenhuma alteração no DMARC é necessária.

> Remetente resultante: `Portal WEES <portal@send.wees.com.br>`.
> Se preferir `portal@wees.com.br`, é preciso adicionar o SPF do Resend ao SPF da raiz
> (`include:amazonses.com`) e o MX de feedback — o que conflita com o Zoho. Recomendado
> manter o subdomínio.
> `rdo.wees.com.br` continua sendo apenas o endereço do site.

## 2. SMTP no Supabase

Painel do Supabase → **Authentication → Emails → SMTP Settings** → *Enable Custom SMTP*:

```
Host:         smtp.resend.com
Port:         465
Username:     resend
Password:     <API Key do Resend>
Sender email: portal@send.wees.com.br
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