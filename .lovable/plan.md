## Análise: outros erros do mesmo tipo (buckets inexistentes)

Após a troca do banco para o Supabase atual, só existem 4 buckets:
`avatars`, `service-report-photos`, `temp-backups`, `company-photos`.

Encontrei 3 buckets referenciados no código que **não existem** no Supabase, causando falhas silenciosas semelhantes à das fotos do WhatsApp:

### 1. `suggestion-screenshots` — quebra upload de sugestões
- `src/components/suggestions/NewSuggestionDialog.tsx` (linhas 71, 77, 108, 114): faz upload do screenshot da sugestão nesse bucket. Falha silenciosa ao anexar imagem em uma nova sugestão.

### 2. `project-photos` — quebra foto de capa do projeto
- `src/components/reports/ProjectSelector.tsx` (linha 2351): `<ImageUploader bucketName="project-photos" />` para a foto do projeto. Upload falha.

### 3. `report-photos` (legado) — backup/restore/estatísticas inconsistentes
- `supabase/functions/generate-backup/index.ts`: tenta baixar de `report-photos` e `project-photos` e `suggestion-screenshots`.
- `supabase/functions/restore-backup/index.ts`: lista os mesmos buckets para restaurar.
- `supabase/functions/get-storage-stats/index.ts`: mostra estatísticas de buckets inexistentes (sempre vazios).

> Observação: `src/lib/generateReportPdf.ts` já trata `report-photos` como legado para URLs antigas — pode permanecer como fallback de leitura.

---

## Plano de correção

**Opção A (recomendada): criar os buckets faltantes**
1. Migration para criar os buckets públicos `suggestion-screenshots` e `project-photos` no `storage.buckets` com políticas de leitura pública e upload por usuários autenticados (mesmo padrão de `service-report-photos`).
2. Não criar `report-photos` (é apenas legado). Remover referências em:
   - `get-storage-stats/index.ts` → remover entrada `report-photos`.
   - `generate-backup/index.ts` → remover linha do bucket `report-photos`.
   - `restore-backup/index.ts` → remover `'report-photos'` da lista.

**Opção B: redirecionar tudo para buckets existentes**
- Trocar `suggestion-screenshots` e `project-photos` por `service-report-photos` (mistura conteúdos de domínios diferentes — não recomendado).

### Itens fora do escopo desse erro
- Demais usos do client (`.from("reports")`, `.from("profiles")` etc.) são tabelas e estão corretas conforme o schema atual.

Confirma seguir com a **Opção A**?
