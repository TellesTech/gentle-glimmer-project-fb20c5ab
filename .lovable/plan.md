## Auditoria SOMENTE LEITURA — nenhuma escrita foi feita

Nenhuma migration, nenhum UPDATE/DELETE/INSERT e nenhuma alteração de código. Apenas `SELECT`.

### 1) Volume
- Total de reports: **1.134**
- Reports com data em julho/2026: **97**

### 2) OM número nulo/inválido
(nulo, vazio, `NA`, `N/A`, `NULL`, `0`, `SEM OM`, `-`): **711** de 1.134 (62,7%)

### 3) OM título nulo/vazio
**346** de 1.134 (30,5%)

### 4) Atividades zeradas
- Com atividades cadastradas, porém **todas** com `completed=false` e `progress=0`: **1.056**
- Sem nenhuma atividade cadastrada: **55**

### 5) Ligação com whatsapp_rdo_logs
- Total de logs: **1.295**
- Logs com `report_id` preenchido apontando para um report existente: **201**
- Reports distintos alcançáveis por log: **139**

### 6) Texto original disponível para reprocessamento
- Dos 201 logs ligados, **201 (100%)** ainda têm texto no `raw_payload` (`message.conversation`, `message.extendedTextMessage.text`, `text.message`, `caption` etc.)
- Reports com pelo menos um texto: **139**
- Reports com texto “rico” (>150 caracteres, ou seja, RDO completo e não apenas legenda de foto): **138**

### 7) Recuperabilidade
| Categoria | Qtde | Situação |
|---|---|---|
| Reports com algum problema (OM ruim, título vazio ou atividades zeradas) | **1.111** | — |
| Afetados **com** log + texto original | **139** | Reprocessáveis automaticamente pelo novo parser determinístico |
| Afetados **sem** log vinculado | **972** | **Exigem revisão manual** |
| Atividades zeradas com log | 126 | Automático |
| Atividades zeradas sem log | 930 | Manual |
| OM ruim (número/título) com log | 105 | Automático |

Motivos da revisão manual dos 972: foram criados antes da vinculação `report_id` nos logs, ou por entrada manual no sistema (web), portanto **não existe texto-fonte** para reprocessar. Para eles só é possível: (a) heurística sobre `report_activities`/`comments` já gravados, ou (b) correção manual/em lote assistida.

Ressalva adicional: parte dos 139 tem múltiplos logs por report (201 logs → 139 reports), incluindo legendas curtas de foto (20–30 caracteres). O reprocessamento deve escolher o **log de maior texto** por report, não o mais recente.

### 8) Exemplos (anonimizados, sem telefones, nomes ou texto integral)
| # | report id | data | OM nº | Título OM | status do log | tam. texto | nº atividades |
|---|---|---|---|---|---|---|---|
| 1 | 8ed0f8f4… | 2026-07-29 | (nulo) | Inspeção e reparo na chaminé | photo_attached | 7882 | 5 |
| 2 | 8ed0f8f4… | 2026-07-29 | (nulo) | Inspeção e reparo na chaminé | photo_attached | 1708 | 5 |
| 3 | 8ed0f8f4… | 2026-07-29 | (nulo) | Inspeção e reparo na chaminé | photo_attached | 29 | 5 |
| 4 | 8ed0f8f4… | 2026-07-29 | (nulo) | Inspeção e reparo na chaminé | photo_attached | 20 | 5 |
| 5 | c3aa5356… | 2026-07-29 | (nulo) | (nulo) | success | 974 | 3 |
| 6 | 07c69fda… | 2026-07-29 | (nulo) | (título com 3 escopos concatenados) | success | 1256 | 3 |
| 7 | c1872f2b… | 2026-07-29 | 22461261 | Transportadora 09 | success | 1111 | 10 |
| 8 | c1872f2b… | 2026-07-29 | 22461261 | Transportadora 09 | success | 1101 | 10 |

O exemplo 6 mostra outro defeito herdado: título da OM com vários escopos concatenados por `;` — o novo parser separa isso corretamente, então esses casos se beneficiam do reprocessamento.

---

## Plano sugerido (a executar só se você aprovar; nada foi feito ainda)

1. **Fase 0 — dry-run**: rodar o novo parser sobre os 139 reports com texto (escolhendo o log de maior comprimento) e gerar um CSV comparativo `antes/depois` (OM nº, título, data, nº de atividades concluídas). Zero escrita.
2. **Fase 1 — backfill seguro**: aplicar apenas nos campos hoje nulos/inválidos, nunca sobrescrever valor válido já existente; gravar snapshot dos valores anteriores antes do update.
3. **Fase 2 — atividades**: marcar `completed=true / progress=100` somente nos reports reprocessados cujo texto confirma "Atividades Executadas".
4. **Fase 3 — os 972 sem log**: tela de revisão em lote (filtro "sem OM" / "0%"), com sugestão automática de OM por similaridade de título e confirmação humana.

### Detalhes técnicos
- Reprocessamento via função Edge dedicada usando `_shared/rdoParser.ts` (determinístico), sem chamada de IA, evitando novas alucinações e custo.
- Seleção do log: `ORDER BY length(texto) DESC LIMIT 1` por `report_id`.
- Idempotência: registrar `reprocessed_at` para não repetir.
