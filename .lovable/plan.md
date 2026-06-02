## Diagnóstico

Pelo print, o item "dddd" é um **projeto** (não uma atividade) no Cabinet de relatórios. O erro "Sem permissão para excluir este item" vem de `src/components/reports/DocumentCabinet.tsx` (linha 267), disparado quando `count === 0` no retorno do `.delete()`.

Verifiquei no banco:
- Políticas RLS de `projects` permitem `super_admin` via `has_role` para `ALL` (SELECT/INSERT/UPDATE/DELETE). Mesma coisa para `sites`, `companies` e `reports`. **Permissão está correta.**
- O projeto "dddd" **não existe mais** no banco (já foi excluído). Mesmo assim o card continua aparecendo no UI porque o React Query não foi invalidado.

## Causa raiz

O handler `handleDelete` interpreta `count === 0` como "sem permissão", mas `count === 0` também ocorre quando a linha simplesmente já não existe (ex.: deletada num clique anterior, cache desatualizado, ou outro usuário deletou). A primeira exclusão funcionou; o erro só aparece em cliques subsequentes sobre um card "fantasma".

## Plano de correção

Ajustar `src/components/reports/DocumentCabinet.tsx` no `handleDelete`:

1. Quando `count === 0` e não houver erro do Postgres → tratar como "item já não existe":
   - Não mostrar toast de erro de permissão.
   - Mostrar toast neutro: `"Item já havia sido removido"` (info).
   - Invalidar as queries do cabinet para o card sumir.
2. Manter o tratamento de erro `23503` (FK) como está.
3. Demais erros continuam como `"Erro ao excluir"`.

Não mexo em RLS nem em outras telas, pois a permissão real do super_admin está correta.

## Detalhes técnicos

Arquivo: `src/components/reports/DocumentCabinet.tsx`, função `handleDelete` (~linhas 244-282). Substituir o bloco:

```ts
if (count === 0) {
  throw new Error('Sem permissão para excluir este item.');
}
```

Por algo como:

```ts
if (count === 0) {
  toast({ title: 'Item já removido', description: `"${deletingItem.name}" não foi encontrado no banco.` });
  queryClient.invalidateQueries({ queryKey: ['reports-cabinet-all-v2'] });
  queryClient.invalidateQueries({ queryKey: ['all-companies-cabinet-v2'] });
  return;
}
```

(antes do `finally`, ajustando o fluxo para limpar `deletingItem` corretamente).