## Objetivo

Remover completamente Autentique e ClickSign do projeto. O fluxo passa a ser exclusivamente a assinatura interna (`report_signatures` + `report_company_approvers` + `signed_pdf_url`). Isso resolve também o erro "Bucket not found" no envio para assinatura, eliminando todo o caminho legado e substituindo o bucket inexistente `report-pdfs` por `service-report-photos`.

## O que será removido

### Edge functions (apagadas + desfeito deploy)
- `supabase/functions/autentique/`
- `supabase/functions/autentique-webhook/`
- `supabase/functions/clicksign/`
- `supabase/functions/clicksign-webhook/`

### Páginas e componentes do app
- `src/pages/AdminClickSign.tsx` — apagar
- `src/hooks/useClickSign.ts` — apagar
- `src/components/reports/SendAutentiqueDialog.tsx` — renomear/substituir por `SendForSignatureDialog.tsx` (mesma UX, mesmas seleções de contatos, sem qualquer chamada Autentique). Corrigir o bucket de upload para `service-report-photos` (pasta `signed-report-pdfs/...`).
- `src/App.tsx` — remover rota e import de `AdminClickSign`.
- `src/pages/ReportDetail.tsx` — trocar import/uso para o novo `SendForSignatureDialog`, remover comentários sobre Autentique.
- `src/components/reports/index.ts` — exportar `SendForSignatureDialog`.
- `src/components/client/ClientLayout.tsx` — remover badge "Autentique ativo".
- `src/components/agents/agentsData.ts` — remover agentes `autentique`, `autentique-webhook`, `clicksign`, `clicksign-webhook`.
- `src/pages/SalesPage.tsx` — substituir menções a Autentique/ClickSign por "Assinatura interna com validade jurídica (MP 2.200-2/2001, captura de IP/geolocalização)".

### Limpeza de consultas e tipos
- `src/pages/client/ClientDashboard.tsx` — remover joins/condições com `autentique_documents` (`autentiqueSigned`). Status passa a depender só de `reports.status` e dos approvers.
- `src/pages/Reports.tsx` — remover consulta a `autentique_documents`.
- `src/pages/SuperAdminPanel.tsx` — remover bloco "Autentique signatures".
- `src/pages/ClientReportView.tsx` e `src/pages/ReportDetail.tsx` — remover filtro `startsWith('autentique:')` (não há mais essa assinatura).
- `src/lib/generateReportPdf.ts` — idem; ajustar comentários.
- `src/hooks/useReportSignaturesRealtime.ts` — remover qualquer referência.
- `src/hooks/useClientPortalSettings.ts` — remover flag(s) de Autentique/ClickSign se houver.

### Backup/restore e storage stats
- `supabase/functions/generate-backup/index.ts`, `supabase/functions/restore-backup/index.ts`, `src/pages/AdminBackup.tsx` — remover tabelas `autentique_documents`, `autentique_signatures`, `clicksign_documents` das listas de backup.
- `supabase/functions/get-storage-stats/index.ts` — remover contagem por `autentique_documents`; contar PDFs assinados via `reports.signed_pdf_url`.
- `supabase/functions/pending-signatures-notification/index.ts` — remover busca a `autentique_documents`/`autentique_signers` e ajustar mensagem do email (sem "Autentique").

### Banco de dados (migration)
Uma única migration que:
- `DROP TABLE` em cascata: `autentique_signers`, `autentique_documents`, `autentique_webhooks`, `clicksign_signers`, `clicksign_documents`, `clicksign_webhooks` (e variantes existentes como `autentique_signatures` se houver).
- Remove triggers/funções/RLS relacionadas.
- Remove secrets do projeto Supabase: `AUTENTIQUE_API_TOKEN`, `CLICKSIGN_API_KEY`, `CLICKSIGN_SANDBOX` (via tool de secrets, não via SQL).

## Correção do envio para assinatura
No novo `SendForSignatureDialog`:
- Upload do PDF assinado em `service-report-photos` na pasta `signed-report-pdfs/{companyId}/{reportId}/RDO-...pdf` (bucket que já existe e tem políticas corretas para `authenticated`).
- Mesma lógica de inserir aprovadores, atualizar `reports.status = 'sent'` e `signed_pdf_url`.
- Tratamento explícito de erros de storage com mensagem amigável.

## Etapas de execução

1. Migration: dropar tabelas/relações Autentique/ClickSign.
2. Apagar edge functions Autentique/ClickSign e tirar do deploy.
3. Substituir `SendAutentiqueDialog` por `SendForSignatureDialog` com bucket correto.
4. Limpar páginas/hooks/componentes que ainda referenciam as integrações.
5. Limpar backup/restore/storage-stats/notification.
6. Atualizar `SalesPage` e textos institucionais.
7. Remover secrets antigas (Autentique/ClickSign).
8. Validar build e fluxo de envio para assinatura.

## Riscos / cuidados

- Backup e restore: garantir que listas atualizadas não tentem ler tabelas removidas.
- Histórico: relatórios antigos cuja assinatura veio só do Autentique perdem essa referência. Como já existem `report_signatures` nativas para o fluxo atual, mantemos apenas elas. Se necessário, manter `signed_pdf_url` antigo intacto.
- Sem quebrar tipos: após migration, o `types.ts` será regenerado automaticamente.