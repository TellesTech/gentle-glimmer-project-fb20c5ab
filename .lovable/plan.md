## Problema

Ao enviar para o portal do cliente, o insert em `report_signatures` falha com:

```
Could not find the 'legal_basis' column of 'report_signatures' in the schema cache
```

O código em `src/components/reports/SendAutentiqueDialog.tsx` (linha 326-336) insere dois campos que não existem na tabela:
- `legal_basis` (valor `'MP 2.200-2/2001'`)
- `signer_email`

Colunas atuais de `report_signatures`: `id, report_id, access_id, signature_data, signer_name, signer_role, signed_at, ip_address, user_agent, signer_user_id`.

## Solução

Adicionar as duas colunas faltantes via migration (são dados úteis para rastreabilidade jurídica e contato do signatário). Ambas nullable, sem default obrigatório, sem mudança de RLS.

### Migration

```sql
ALTER TABLE public.report_signatures
  ADD COLUMN IF NOT EXISTS legal_basis text,
  ADD COLUMN IF NOT EXISTS signer_email text;
```

Sem mudanças de código — o insert atual passa a funcionar.

## Resultado esperado

- Envio para o portal do cliente conclui sem erro de schema.
- Assinatura WEES é registrada com `legal_basis` e `signer_email` populados.