## Botão "Sincronizar com RDOs" em /workforce-database

### Contexto
Hoje a página já mescla RDO + manual em runtime (`loadRecords`), mas as tabelas `workforce_database` e `workforce_delays` continuam vazias. Isso impede uso externo (queries SQL, BI, exportações batch). O botão materializa esses dados.

### Mudanças

**1. Migration — índices únicos para suportar upsert idempotente**
- `workforce_database`: `UNIQUE (attendance_id)` — uma linha por presença de RDO.
- `workforce_delays`: nova coluna `report_id uuid REFERENCES reports(id) ON DELETE CASCADE` + `delay_source text` ('operational'|'climatic'|'amt') + `UNIQUE (report_id, delay_source)`. Isso permite re-sincronizar sem duplicar atrasos.

**2. UI em `src/pages/WorkforceDatabase.tsx`**
- Novo botão "Sincronizar com RDOs" (ícone `RefreshCw`) ao lado dos botões existentes (Import/Export).
- Mostra `ConfirmDialog` antes ("Vai materializar todos os RDOs do período filtrado em workforce_database/workforce_delays. Continuar?").
- Durante execução: estado `syncing`, toast "Sincronizando…", spinner no botão.

**3. Lógica de sincronização (função `syncFromRdos`)**
- Respeita filtros atuais (`startDate`, `endDate`, `selectedSite`, `selectedProject`).
- **Presenças**: pagina `report_attendance` + `reports(date, project_id, projects(site_id, company_id))`, agrupa por (worker+date) igual ao `loadRecords`, calcula horas via `calculateWorkHours`/`mergeAndCalculateWorkHours`, e faz `upsert` em lotes de 500 em `workforce_database` usando `onConflict: 'attendance_id'`. Para grupos com múltiplos turnos, grava na linha do primeiro `attendance_id` do grupo e remove as demais entradas órfãs do mesmo grupo via `DELETE WHERE attendance_id IN (resto)`.
- **Atrasos**: pagina `reports` no período; para cada `report` e cada tipo (operational/climatic/amt) com `*_deviation_hours > 0`, faz `upsert` em `workforce_delays` com `onConflict: 'report_id,delay_source'`. Mapeia `delay_type` (enum existente) a partir do tipo.
- Resultado final: toast com contagem `"N presenças e M atrasos sincronizados"`.
- Após sync, chama `loadRecords()` e `loadDelays()` para atualizar a UI.

**4. Permissões**
- Botão visível apenas para `admin` / `super_admin` (mesmo padrão dos outros botões de escrita).

### Fora de escopo
- Não vou alterar o cálculo CLT, layout das abas, nem dedupe runtime (continua RDO sobrescrevendo manual na visualização).
- Não vou criar job recorrente / cron — só botão manual.
- Item D do plano anterior fica concluído após isso.
