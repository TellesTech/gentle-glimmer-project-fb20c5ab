# DNS de `send.wees.com.br` (envio via Resend)

DNS do domínio: **Cloudflare** (`arvind.ns.cloudflare.com`).
O raiz `wees.com.br` usa **Zoho Mail** — nada nesses passos toca nos registros do Zoho.

## Passo 1 — Criar o domínio no Resend

Painel Resend → **Domains → Add Domain** → `send.wees.com.br` → região **South America (sa-east-1)**.

O Resend exibe 3 registros com a **chave DKIM única** da sua conta. Sem esse passo não há
como saber o valor do DKIM (a API Key conectada aqui é restrita a envio e não lista domínios).

## Passo 2 — Criar os registros no Cloudflare

Cloudflare → zona `wees.com.br` → **DNS → Records → Add record**.
Todos com **Proxy status: DNS only** (nuvem cinza) e **TTL Auto**.

| # | Type | Name              | Conteúdo                                        | Prioridade |
|---|------|-------------------|-------------------------------------------------|-----------|
| 1 | MX   | `send`            | `feedback-smtp.sa-east-1.amazonses.com`          | 10        |
| 2 | TXT  | `send`            | `v=spf1 include:amazonses.com ~all`              | —         |
| 3 | TXT  | `resend._domainkey.send` | `p=<chave DKIM exibida no Resend>`        | —         |

Observações:
- No Cloudflare, o campo **Name** aceita o nome curto (`send`) — ele completa para
  `send.wees.com.br`. Se copiar o nome completo do Resend, também funciona.
- Se o Resend indicar outra região, troque `sa-east-1` no registro MX pela região mostrada.
- O DKIM do Resend pode vir como `p=MIGf...` (longo). Cole o valor inteiro, sem quebras.

## Passo 3 — Não alterar

- MX do raiz (`mx.zoho.com`, `mx2`, `mx3`) — e-mail corporativo.
- SPF do raiz (`v=spf1 include:zohomail.com include:_spf.mail.hostinger.com ~all`).
- `_dmarc.wees.com.br` já existe com `adkim=r` / `aspf=r` (relaxado) e cobre o subdomínio
  via `sp=none`. Nenhuma mudança necessária.

## Passo 4 — Verificar

Rodar:

```bash
./scripts/check-send-dns.sh
```

Os três registros devem aparecer preenchidos. Depois, no Resend, clicar em **Verify DNS Records**
até o status ficar **Verified** (normalmente minutos no Cloudflare).

## Passo 5 — Usar no envio

Depois de verificado, o remetente passa a ser `Portal WEES <portal@send.wees.com.br>`
(SMTP do Supabase — ver [README.md](./README.md), etapa 2).
Para o SMTP é preciso uma API Key **Full access** no Resend; a atual só envia via gateway.
