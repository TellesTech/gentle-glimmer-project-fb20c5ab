## Problema

A função "Interpretar com IA" do RDO está falhando com erro:
```
invalid model: google/gemini-2.0-flash-001
```

O modelo `google/gemini-2.0-flash-001` foi descontinuado pelo gateway de IA da Lovable e não está mais na lista de modelos permitidos.

## Solução

Substituir `google/gemini-2.0-flash-001` por `google/gemini-2.5-flash` (modelo equivalente, rápido e atualmente suportado) nas 5 edge functions afetadas:

1. `supabase/functions/parse-report-text/index.ts` — causa direta do erro reportado
2. `supabase/functions/generate-report-summary/index.ts`
3. `supabase/functions/magic-write/index.ts`
4. `supabase/functions/ai-assistant/index.ts`
5. `supabase/functions/zapi-webhook/index.ts`

Mudança simples de string, sem alteração de lógica. Após o deploy, "Interpretar com IA" voltará a funcionar.