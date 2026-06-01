## Problema

No `ProjectSelector` (Passo 1 — Selecione a Fábrica), quando `companies.length === 0`, o componente renderiza apenas o `EmptyState` "Nenhuma fábrica encontrada" e **não** renderiza o `CreateCard` "Nova Fábrica". Resultado: admins sem nenhuma fábrica cadastrada veem a tela vazia sem nenhum botão para criar a primeira fábrica.

O `CreateCard` só aparece no ramo `else` (quando já existem fábricas), em `src/components/reports/ProjectSelector.tsx:1457-1466`.

## Correção

Em `src/components/reports/ProjectSelector.tsx`, no bloco do Passo 1 (linhas ~1432-1439), quando `companies.length === 0` e `isAdmin === true`, mostrar também o `CreateCard "Nova Fábrica"` ao lado do `EmptyState` (ou substituir o EmptyState por uma mensagem curta + o CreateCard). Para não-admin, manter apenas o EmptyState atual.

Comportamento esperado:
- Admin sem fábricas: vê o card "Nova Fábrica" (e opcionalmente uma mensagem orientando o cadastro).
- Não-admin sem fábricas: vê o EmptyState atual.
- Com fábricas: comportamento atual inalterado.

## Arquivos

- `src/components/reports/ProjectSelector.tsx` — único arquivo alterado, ajuste no bloco condicional do Passo 1.

Sem mudanças de schema, RLS, edge functions ou rotas.
