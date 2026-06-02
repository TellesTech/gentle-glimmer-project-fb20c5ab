## Objetivo
Adicionar um botão "Remover Duplicatas" no diálogo de importação de colaboradores que remove completamente os itens duplicados da lista de preview (não apenas marca como skip).

## Local
`src/components/users/ImportCollaboratorsDialog.tsx` — seção `step === 'preview'`

## O que será feito
1. Adicionar função `removeDuplicates` que filtra o estado `collaborators`, removendo todos os itens com `isDuplicate === true`.
2. Adicionar botão "Remover Duplicatas" junto aos botões de ação existentes (`Selecionar Todos`, `Pular Duplicatas`, `Importar Duplicatas`).
3. O botão só aparece quando `duplicateCount > 0`.
4. Atualizar o `Badge` de resumo (contagem de encontrados/duplicatas/selecionados) automaticamente após a remoção, pois o estado reage normalmente.

## Comportamento
- Ao clicar, todos os colaboradores marcados como duplicatas (`isDuplicate: true`) são removidos da lista `collaborators`.
- O contador de duplicatas no resumo zera.
- Os colaboradores restantes continuam selecionáveis/importáveis normalmente.
- Nenhuma mudança no backend ou Edge Function.