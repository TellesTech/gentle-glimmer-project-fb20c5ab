## Plano

Corrigir a ação `delete-all-collaborators` na edge function `admin-users` para que a exclusão em massa realmente encontre os colaboradores de registro (`@internal.local`) sem estourar limite de URL.

### Mudança principal

- Trocar o filtro atual:
  - `profiles.in('id', collaboratorUserIds).ilike('email', '%@internal.local')`
- Por uma busca paginada em `profiles`:
  - `select('id, email')`
  - `ilike('email', '%@internal.local')`
  - `.range(...)` em blocos de 1000
- Cruzar em memória com `Set(collaboratorUserIds)` para manter apenas IDs que também têm role `collaborator`.

### Escopo

- Alterar apenas `supabase/functions/admin-users/index.ts`.
- Manter o botão e o fluxo atual da tela `/users` sem mudanças.
- Manter os logs existentes de contagem para facilitar diagnóstico.
- Preservar a regra de não excluir o próprio usuário autenticado.

### Resultado esperado

Ao clicar em **Excluir Todos**, a função deve localizar corretamente os colaboradores `@internal.local`, excluir em massa pelo Admin API e retornar a quantidade removida no toast.