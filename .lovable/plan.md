## Problema

Ao criar uma atividade, o app envia `status: ""` (string vazia) para o Supabase, e o Postgres rejeita com `invalid input value for enum project_status: ""`.

Origem: `src/components/reports/ProjectSelector.tsx` linha 322 inicializa `projectFormData.status = ''`, e a linha 1167 envia esse valor direto no insert sem fallback.

## Correção

Em `src/components/reports/ProjectSelector.tsx`, linha 1167, trocar:

```ts
status: projectFormData.status,
```

por:

```ts
status: projectFormData.status || 'planning',
```

Isso garante que, quando o usuário não seleciona um status no formulário, a atividade é criada como `planning` (mesmo valor padrão da coluna no banco) em vez de mandar string vazia.

Mudança pontual, 1 linha, sem impacto em outras telas.