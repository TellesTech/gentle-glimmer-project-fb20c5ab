## Análise da base de dados de HH (Homem-Hora)

Auditei tabelas, hook de métricas e telas relacionadas. Encontrei **5 problemas concretos**, do mais grave ao menor.

### Problemas encontrados

**1. Tabela `impact_settings` não existe no banco (CRÍTICO)**
- O hook `useImpactSettings` em `src/hooks/useImpactMetrics.ts` faz `from('impact_settings').select(...).single()`.
- A tabela nunca foi criada. A consulta falha silenciosamente; toda a tela `/admin/impact` e a aba "Métricas de Impacto" em Configurações ficam quebradas (loading infinito ou usando defaults sem persistir).
- A função `useUpdateImpactSettings` tenta salvar e dá erro ao usuário.

**2. 24 de 262 registros em `report_attendance` estão sem `user_id`**
- Todos são pessoas com nome curto/ambíguo ("Manoel", "Ricardo", "Luciano", "Elvis", "Jocivan"...) que não bateram unicamente com `profiles` pela função `link_workforce_to_profiles()`.
- Consequência: o cálculo de HH baseado em `user_id` perde gente. Worker-months por `user_id` = 59, por nome normalizado = 77 (≈23% subcontado).

**3. Mês de referência usa `created_at` em vez de `date` do RDO**
- Em `useImpactStats`, o agrupamento mensal e os pares (worker, mês) usam `reportDateMap` com `r.created_at`.
- RDO de obra do dia 30/05 lançado em 02/06 conta no mês errado, distorcendo o gráfico de horas economizadas.

**4. Tabelas `workforce_database`, `workforce_delays` e `project_daily_workforce` estão vazias (0 linhas)**
- A página `/workforce-database` consulta essas tabelas, então abas Dashboard/Relatórios/IA aparecem vazias mesmo havendo 262 presenças registradas.
- Os dados existem em `report_attendance` mas nunca foram propagados para `workforce_database`.

**5. Normalização de nomes inconsistente**
- `useImpactMetrics` faz `(user_name || '').trim().toUpperCase()` — não remove acentos nem múltiplos espaços. "José" vira diferente de "Jose"; "Maria  Silva" diferente de "Maria Silva". Cria worker-months fantasmas.

### Correções propostas

**A. Migration — criar `impact_settings` (resolve 1)**

```sql
CREATE TABLE public.impact_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  manual_time_per_rdo integer NOT NULL DEFAULT 10,
  system_time_per_rdo integer NOT NULL DEFAULT 1,
  hourly_salary numeric NOT NULL DEFAULT 25,
  work_hours_per_day integer NOT NULL DEFAULT 8,
  work_days_per_month integer NOT NULL DEFAULT 22,
  document_search_time integer NOT NULL DEFAULT 60,
  hh_calculation_time integer NOT NULL DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- GRANTs + RLS (admins editam, todos autenticados leem) + trigger updated_at
-- Seed da linha global (company_id NULL)
```

**B. Backfill de `user_id` em `report_attendance` (resolve 2)**
- Rodar `SELECT public.link_workforce_to_profiles()` (já existe) e relatar quantos foram vinculados.
- Para os ambíguos remanescentes (Manoel/Ricardo/...), deixar como está e mostrar aviso na UI — não dá pra adivinhar sem confirmação humana.

**C. Hook `useImpactMetrics` (resolve 3 e 5)**
- Buscar `date` (data real do RDO) em vez de só `created_at` e usar ela no `monthKey` e nos pares (worker, mês).
- Substituir `normalizeName` por versão que faz `unaccent + lower + collapse spaces` (espelhando a função SQL `link_workforce_to_profiles`).
- Fallback: quando `user_id` está nulo, usar nome normalizado como chave do worker-month (assim os 24 sem vínculo entram no cálculo sem duplicar quem já tem id).

**D. População de `workforce_database` (resolve 4) — opcional, requer decisão**
- Posso criar um botão "Sincronizar com RDOs" na página `/workforce-database` que copia presenças de `report_attendance` calculando horas via `calculateWorkHours` já existente. **Confirme se quer isso agora ou em outra rodada** — é o escopo maior dos 5.

### Fora de escopo
- Não vou alterar layout/cores das telas.
- Não vou mexer em `report_attendance` apagando duplicatas — só preenchendo `user_id` via função existente.
- Item D só faço se você confirmar (impacto em outra tela, não estritamente "erro").
