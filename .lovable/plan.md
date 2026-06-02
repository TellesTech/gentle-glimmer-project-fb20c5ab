## Problema

Algumas planilhas têm abas ocultas (hidden/veryHidden) que o ExcelJS lista em `workbook.worksheets`, mas que podem não estar contando ou exibindo o nome corretamente. Além disso, hoje só mostramos a tela de seleção quando há mais de 1 aba — e queremos incluir as ocultas.

## Solução

Em `src/components/users/ImportCollaboratorsDialog.tsx`, no fluxo `parseFile`:

1. Após carregar o workbook, considerar **todas** as abas (`workbook.worksheets`), inclusive `hidden` e `veryHidden`.
2. Se houver mais de 1 aba (qualquer estado), mostrar a tela `selectSheet` com:
   - Nome da aba
   - Quantidade de linhas
   - Badge "Oculta" para abas com `state !== 'visible'`
3. Manter o comportamento atual de pular direto para análise quando houver apenas 1 aba.
4. Ordenar as abas: visíveis primeiro, depois ocultas.

Nenhuma mudança no backend / edge function.
