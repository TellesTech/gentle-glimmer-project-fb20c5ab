## Objetivo
Quando a IA marcar uma linha como duplicada (nome já existe no sistema ou aparece repetido na planilha), o usuário poderá decidir caso a caso o que fazer, em vez de a linha ficar apenas desmarcada.

## Mudanças

**`src/components/users/ImportCollaboratorsDialog.tsx`**

1. Estender o tipo `Collaborator` com um campo `action: 'skip' | 'import'` (padrão `'skip'` para duplicatas, `'import'` para os demais). O `selected` passa a ser derivado de `action === 'import'`.
2. Na coluna **Status** da tabela de pré-visualização:
   - Linhas OK: continuam mostrando badge "OK" e checkbox normal.
   - Linhas duplicadas: substituir o checkbox por um `Select` com as opções:
     - "Pular" (não importa)
     - "Importar mesmo assim" (cria novo registro, mesmo havendo nome igual)
   - Mostrar abaixo do nome o motivo (ex.: "Já cadastrado no sistema" ou "Duplicado na planilha").
3. Adicionar uma nova ação em massa: "Importar todas as duplicatas mesmo assim" (além das já existentes "Selecionar Todos" e "Desmarcar Duplicatas").
4. Atualizar o contador de selecionados e o botão "Importar N" para considerar `action === 'import'`.
5. Nenhuma mudança na edge function `import-collaborators` — ela já cria um novo registro para cada item recebido (sem deduplicar por nome no servidor).

## Comportamento resultante
- Linhas únicas: continuam selecionadas por padrão.
- Linhas duplicadas: por padrão ficam como "Pular", mas o usuário pode mudar para "Importar mesmo assim" individualmente ou em lote.
- O botão de importar envia somente as linhas com `action = 'import'`.
