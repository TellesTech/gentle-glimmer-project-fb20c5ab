## Diagnóstico

O fluxo "Enviar para Assinatura" faz upload do PDF assinado no bucket `service-report-photos` (pasta `signed-report-pdfs/...`). Duas mudanças recentes provavelmente quebraram esse fluxo para usuários não-administradores e/ou em qualquer usuário:

1. **`storage.buckets` tem RLS habilitado e ZERO políticas** — quando o cliente autenticado tenta fazer upload, o storage não consegue localizar o bucket porque a query interna em `storage.buckets` é bloqueada por RLS. Sintoma: erro "Bucket not found".

2. **Política `UPDATE` em `storage.objects` para `service-report-photos`** foi restringida a `admin/director/supervisor/super_admin`. O código atual usa `upsert: true` no upload — isso requer permissão de UPDATE mesmo quando o arquivo é novo, pelo path inclui `Date.now()` e nunca colide. Isso quebra usuários com papel `leader` ou `collaborator` que também precisam enviar RDOs para assinatura.

3. O `catch` do erro de upload mascara a mensagem real ("Não foi possível salvar o PDF assinado"), dificultando diagnóstico. Vamos preservar a mensagem original do storage no toast e no console.

## Mudanças

### 1. Migração SQL — política SELECT em `storage.buckets`

Adicionar política para que qualquer usuário autenticado consiga "ver" os buckets públicos do sistema (necessário para o storage validar a existência do bucket no upload):

```sql
CREATE POLICY "Authenticated can read public buckets"
ON storage.buckets
FOR SELECT TO authenticated
USING (id IN ('service-report-photos', 'avatars', 'company-photos'));
```

### 2. `src/components/reports/SendForSignatureDialog.tsx`

- Trocar `upsert: true` por `upsert: false` no upload do PDF (filename já é único via `Date.now()`), evitando exigência de permissão UPDATE.
- Melhorar o `catch` do upload: incluir `uploadErr.message` no `Error` lançado para que o toast mostre o motivo real ("Bucket not found", "new row violates row-level security policy", etc.).

### 3. Validação

- Recarregar o app, abrir um RDO como o Alefy, clicar "Enviar para Assinatura" e confirmar que o RDO muda para `sent` sem erro.
- Verificar console: deve aparecer `[useStorageUpload] Upload success...` ou, se falhar, a mensagem real do storage.

## Fora de escopo

- Não mexer no fluxo de assinatura interna (canvas, fontes, etc.) — só na publicação do PDF.
- Não alterar políticas em `storage.objects` (mantém o hardening recente).
