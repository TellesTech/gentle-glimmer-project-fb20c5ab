## Objetivo

Varrer todas as presenças (`report_attendance`) e lançamentos manuais (`workforce_database`) com `user_id` nulo e tentar vincular ao colaborador correto em `profiles`, usando match seguro por nome. Entregar o resultado com log do que foi vinculado, do que ficou ambíguo e do que não tem match.

## Estado atual

- `profiles`: 220 cadastros (217 com função).
- `report_attendance`: 164 presenças, **18 sem `user_id`**, 146 já vinculadas.
- `workforce_database`: vazia (sem lançamentos manuais para processar).
- Conclusão: o trabalho real está sobre as 18 presenças órfãs (e qualquer nova que apareça).

## Estratégia de match (3 níveis, mais seguro → menos seguro)

Normalização aplicada a todos os nomes antes de comparar:
1. `lower()` + `unaccent()` (remove acentos)
2. Colapsa espaços múltiplos e trim
3. Remove pontuação

| Nível | Critério | Ação |
|---|---|---|
| **1. Exato** | nome normalizado idêntico, 1 único profile | Vincula automaticamente |
| **2. Primeiro + último nome** | mesmo primeiro nome E mesmo último nome, 1 único profile | Vincula automaticamente |
| **3. Similaridade pg_trgm ≥ 0.85** | `similarity(name_norm, profile_norm) >= 0.85`, 1 único profile | Vincula automaticamente |
| **Ambíguo** | match em mais de 1 profile em qualquer nível acima | **Não vincula**, registra no log para revisão manual |
| **Sem match** | nenhum profile com similaridade ≥ 0.85 | **Não vincula**, registra como "novo colaborador a cadastrar" |

Casos como "Elvis" ou "Maranhão" (só primeiro nome / apelido) cairão em ambíguo ou sem match — são exatamente os que não devem ser vinculados automaticamente.

## Execução

1. **Migração**: garantir extensões `unaccent` e `pg_trgm` habilitadas (são extensões padrão Supabase, normalmente já estão).
2. **Função SQL `link_workforce_to_profiles()`** (SECURITY DEFINER, idempotente):
   - Aplica os 3 níveis em ordem.
   - Faz `UPDATE report_attendance SET user_id = ...` e `UPDATE workforce_database SET worker_id = ...` (se a coluna existir; conferir antes).
   - Retorna tabela com: `source`, `record_id`, `nome_original`, `nome_match`, `profile_id`, `nivel_match`, `acao` ('vinculado' | 'ambiguo' | 'sem_match').
3. **Executar a função uma vez** via `supabase--insert` chamando `SELECT * FROM link_workforce_to_profiles()`.
4. **Exportar log completo** para `/mnt/documents/vinculacao_hh_<timestamp>.csv` com todas as linhas (vinculados + ambíguos + sem match).
5. **Entregar resumo no chat**: quantos vinculados em cada nível, quantos ambíguos, quantos sem match, com a lista dos ambíguos/sem match em tabela markdown para ação humana.

## O que NÃO vou fazer (segurança)

- Não vinculo automaticamente em casos ambíguos ou de baixa similaridade — eles vão para o log de revisão manual.
- Não crio profiles novos automaticamente.
- A função fica disponível para re-execução sempre que novos RDOs forem criados (idempotente — só toca em registros com `user_id` nulo).

## Entregável

- 1 migração (função SQL).
- 1 arquivo CSV em `/mnt/documents/` com o log completo.
- Resumo no chat com contagens e lista de pendências de revisão manual.
