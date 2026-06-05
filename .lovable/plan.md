## Auditoria de Edge Functions — referências quebradas pós-migração

Buckets que **existem** no Storage: `avatars`, `service-report-photos`, `temp-backups`, `company-photos` + os recém-criados `project-photos` e `suggestion-screenshots`.

Tabelas existentes conforme o schema injetado em contexto (lista em `<supabase-tables>`).

### 1. Buckets inexistentes ainda referenciados

| Bucket | Onde | Impacto |
|---|---|---|
| `report-pdfs` | `generate-backup/index.ts:70`, `restore-backup/index.ts:334`, `src/pages/AdminBackup.tsx:1260-1479` | Backup nunca inclui PDFs assinados; restore tenta restaurar bucket inexistente. Os PDFs reais ficam em `service-report-photos/signed-report-pdfs/...` |

### 2. Tabelas referenciadas que NÃO existem no schema atual

| Tabela | Função | Observação |
|---|---|---|
| `api_keys` | `admin-api-keys/index.ts:55,68` | Função inteira quebrada |
| `ai_alert_notifications` | `critical-activities-notification/index.ts:285,337` | Inserts/leituras falham |
| `backup_schedules` | `scheduled-backup/index.ts:55,176,211`, listado em `generate-backup` TABLE_ORDER:57 | Agendamento de backup quebrado |
| `backup_history` | `scheduled-backup/index.ts:66,162,196`, `generate-backup` TABLE_ORDER:58 | Histórico de backup não persiste |
| `client_wallet`, `client_wallet_transactions`, `rewards_catalog`, `reward_redemptions` | `generate-backup` TABLE_ORDER:27-30 | Backup loga erro nessas tabelas (mas continua) |
| `report_history` | `generate-backup` TABLE_ORDER:47 | Idem |
| `delay_reasons` | `generate-backup` TABLE_ORDER:56 | Nome correto é `delay_reason_options` |
| `data_corrections_log` | `health-check/index.ts:117` | Health check reporta falso negativo |
| `time_clock_imports`, `time_clock_records` | `parse-afd/index.ts:186,229` | Importação de AFD não persiste |

### 3. Itens OK
- Buckets `service-report-photos`, `company-photos`, `avatars`, `project-photos`, `suggestion-screenshots` agora estão íntegros.
- Demais `.from("...")` apontam para tabelas existentes.
- Path interno `signed-report-pdfs/...` dentro do bucket `service-report-photos` funciona.

---

## Plano de correção

### A. Backup/restore — alinhar com Storage real
1. Em `generate-backup/index.ts`:
   - Remover entrada `bucket: 'report-pdfs'` de `FILE_SOURCES` (PDFs assinados já estão em `service-report-photos/signed-report-pdfs/...` e serão incluídos pela linha do `service_report_photos`? **não** — vou adicionar uma entrada que aponta para `service-report-photos` com folder `signed-report-pdfs/` lendo de `reports.signed_pdf_url`).
   - Remover de `TABLE_ORDER` as tabelas inexistentes: `client_wallet`, `client_wallet_transactions`, `rewards_catalog`, `reward_redemptions`, `report_history`.
   - Corrigir `delay_reasons` → `delay_reason_options`.
2. Em `restore-backup/index.ts:334`: remover `'report-pdfs'` da lista de buckets a restaurar.
3. Em `src/pages/AdminBackup.tsx`: trocar referências a bucket `report-pdfs` por leitura do bucket `service-report-photos` no prefixo `signed-report-pdfs/`.

### B. Health check
- Em `health-check/index.ts:117`: remover/condicionar a checagem de `data_corrections_log` (tabela ausente), ou criar a tabela se ela faz parte de um recurso vivo. Como ela não aparece em nenhum outro lugar do código, **remover** a checagem.

### C. Funções que dependem de tabelas faltantes — decisão necessária
As funções abaixo estão quebradas porque suas tabelas não existem no banco atual. Preciso de orientação:

- **`admin-api-keys`** (tabela `api_keys`) — recriar a tabela ou desativar a função?
- **`critical-activities-notification`** (tabela `ai_alert_notifications`) — recriar ou desativar?
- **`scheduled-backup`** + entradas em `generate-backup` (tabelas `backup_schedules`, `backup_history`) — recriar ou desativar?
- **`parse-afd`** (tabelas `time_clock_imports`, `time_clock_records`) — recriar ou desativar?

Para cada uma, posso (1) criar uma migration recriando a tabela com RLS/grants padrão, ou (2) marcar a função como descontinuada (retornando 410 e ocultando a UI que a chama).

### Resposta esperada
Responda apenas com a lista das funções a **recriar** e a **desativar**, ex.: "recriar: scheduled-backup, parse-afd; desativar: admin-api-keys, critical-activities-notification". Os itens A e B eu executo direto após aprovação do plano.
