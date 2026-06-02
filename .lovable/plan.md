## Plano

1. **Corrigir o salvamento da liberação por fábrica**
   - Fazer o botão **Salvar** tratar erro também na etapa `set-user-sites`.
   - Só mostrar “Usuário atualizado com sucesso” depois que dados do colaborador e fábricas forem salvos com sucesso.
   - Atualizar a contagem/listagem após salvar, para o badge de fábricas refletir o banco.

2. **Ajustar o caso de admin/super_admin selecionado como colaborador de fábrica**
   - Hoje a função escolhe uma tabela diferente conforme o papel do usuário: `admin` vai para `portal_admin_access`, enquanto colaborador vai para `site_responsibles`.
   - Para não perder acesso quando o papel muda ou quando um admin é liberado por fábrica, vou fazer a gravação manter as tabelas coerentes e evitar sobras conflitantes.

3. **Validar o caso do Alef**
   - Conferi no banco que **Jose Alefy Viana Jovino** está como `super_admin` e possui 1 fábrica registrada.
   - Como `super_admin` deve ver todas as fábricas automaticamente, vou garantir que a UI não dependa da tabela de liberação para ele.
   - Para usuários `admin`/`collaborator`, o seletor do portal continuará usando apenas as fábricas atribuídas.

## Arquivos previstos

- `src/pages/Users.tsx`
- `supabase/functions/admin-users/index.ts`

## Resultado esperado

- Ao selecionar fábricas e salvar, falhas de gravação aparecem na tela em vez de parecer que salvou.
- O acesso por fábrica passa a aparecer corretamente no seletor/topo/sidebar para usuários internos com acesso restrito.
- Super admins continuam com acesso total, independentemente das fábricas selecionadas.