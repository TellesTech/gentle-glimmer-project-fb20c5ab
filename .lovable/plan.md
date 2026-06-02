## Diagnóstico

A função já está encontrando os colaboradores corretamente. O problema agora é outro: ela tenta apagar todos os usuários encontrados em uma única execução da Edge Function.

Pelos sinais atuais:
- A chamada retorna `WORKER_RESOURCE_LIMIT`.
- Os logs mostram que a função encontrou `446` colaboradores para excluir.
- A execução morreu antes de finalizar o loop de exclusão.
- Consulta atual no banco indica que ainda restam `127` colaboradores importados com email `@internal.local`.

## Plano de correção

Alterar a exclusão em massa para funcionar em lotes pequenos, evitando estourar o limite de compute da Edge Function.

### 1. Backend: limitar cada execução da Edge Function
No case `delete-all-collaborators` em `supabase/functions/admin-users/index.ts`:

- Manter a busca paginada por `profiles.email ilike '%@internal.local'`.
- Cruzar os IDs em memória com os usuários que têm role `collaborator`.
- Em vez de tentar apagar todos de uma vez, apagar apenas um lote por chamada, por exemplo `25` usuários.
- Retornar no JSON:
  - `deletedCount`: quantos foram removidos nesta chamada.
  - `remainingCount`: quantos ainda restam para apagar.
  - `hasMore`: se ainda há mais colaboradores importados para excluir.
  - `errors`: erros individuais, se houver.

### 2. Frontend: repetir chamadas até acabar
Em `src/pages/Users.tsx`, no `handleBulkDeleteCollaborators`:

- Chamar `delete-all-collaborators` em loop.
- Continuar enquanto a resposta vier com `hasMore: true`.
- Somar o total apagado entre as chamadas.
- Atualizar o toast ao final com o total removido.
- Se algum lote falhar, mostrar erro claro e parar o loop.

### 3. Melhorar mensagem de erro
Ainda no frontend:

- Trocar o erro genérico `Edge Function returned a non-2xx status code` por uma mensagem mais útil quando a Edge Function retornar erro estruturado.
- Assim, se sobrar algum bloqueio real de exclusão, o toast vai mostrar o motivo.

## Resultado esperado

Ao clicar em **Excluir Todos**, o sistema vai apagar os colaboradores importados em várias execuções curtas, até zerar todos os registros `@internal.local`, sem cair no limite de recursos da Edge Function.