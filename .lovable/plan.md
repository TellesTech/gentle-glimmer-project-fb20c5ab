## Plano

1. **Corrigir a gravação de acesso por fábrica**
   - Ajustar a ação `set-user-sites` da Edge Function `admin-users` para salvar os acessos de forma idempotente, evitando erro quando já existir vínculo parcial em `site_responsibles` ou `portal_admin_access`.
   - Tratar conflitos de chave única como operação segura, usando upsert/ignore em vez de insert simples.

2. **Melhorar diagnóstico do erro**
   - Manter a resposta da função com mensagem real do banco quando falhar, para o toast não mostrar apenas “non-2xx status code”.
   - Preservar CORS em todas as respostas.

3. **Validar o fluxo no backend**
   - Testar a chamada `admin-users` com `set-user-sites` para o colaborador da tela e a fábrica “Bahia”.
   - Confirmar no banco se o vínculo foi salvo nas tabelas usadas pelo app.

## Arquivos prováveis

- `supabase/functions/admin-users/index.ts`

## Observação

A constraint do `portal_admin_access` já está como `UNIQUE (user_id, site_id)`, então o próximo ajuste deve ser no código da função para lidar melhor com inserções repetidas/parciais entre as duas tabelas.