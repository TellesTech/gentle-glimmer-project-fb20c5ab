## Problema

Em `/reports/new`, quando não existe nenhuma fábrica cadastrada, o `QuickReportWizard` mostra um `EmptyState` com o botão **"Cadastrar Fábrica"**, que navega para `/companies-manage`. Essa rota está definida em `App.tsx:133` como um `<Navigate to="/reports/new" replace />`, ou seja, **redireciona de volta para a mesma página**. Resultado: o clique não faz nada visível — o usuário fica preso na tela vazia.

A criação real de fábrica acontece dentro de `ProjectSelector` (botão "Nova Fábrica" → abre o diálogo `createCompanyOpen` → `handleSaveCompany` faz `supabase.from('companies').insert(...)`). Mas o `ProjectSelector` só é renderizado quando `hasCompanies === true`, então o usuário inicial nunca chega a ele.

## Outras navegações quebradas encontradas no sistema

Varredura completa de `navigate(...)` / `<Link to=...>`:

1. **`/sites/${siteId}`** (sem `/dashboard`) em `src/pages/SiteDashboard.tsx:533` e `:727` (botão "Gerenciar Atividades") — rota redireciona para `/reports/new`. Deveria abrir o seletor de atividades da unidade.
2. **`/companies/${companyId}/sites?create=true`** em `src/pages/CompanyDashboard.tsx:1095` — rota não existe, cai em `NotFound`.
3. **`/companies-manage`** usado também em `src/pages/Teams.tsx:190`, `src/pages/TeamDetails.tsx:408` e `src/pages/SuperAdminPanel.tsx:525` — funciona "por acaso" porque redireciona para `/reports/new` onde o `ProjectSelector` mostra as fábricas, mas falha no mesmo caso de zero fábricas.

## Plano de correção

### 1. `src/pages/QuickReportWizard.tsx`
Remover o `EmptyState` bloqueante e **sempre renderizar `ProjectSelector`**. Quando não há fábricas e o usuário é admin/super_admin, o `ProjectSelector` já mostra naturalmente o card "Nova Fábrica" (linha 1457-1466) que abre o diálogo de criação. Isso resolve o loop e dá um caminho real para criar a primeira fábrica.

Para usuários **não-admin** sem fábricas, mostrar uma mensagem clara orientando a contatar um administrador (em vez do botão quebrado).

### 2. `src/pages/SiteDashboard.tsx`
Substituir os dois `navigate(\`/sites/${siteId}\`)` por uma navegação válida. O destino pretendido pelo texto "Gerenciar Atividades" é o seletor de atividades daquela unidade — apontar para `/reports/new` mantendo a unidade pré-selecionada (mesmo padrão já usado no fluxo) ou simplesmente para `/sites/${siteId}/dashboard` (rota válida) recarregando a própria página. A opção mais consistente é navegar para `/reports/new` (que mostra o `ProjectSelector` completo).

### 3. `src/pages/CompanyDashboard.tsx`
Trocar `navigate(\`/companies/${companyId}/sites?create=true\`)` por `navigate('/reports/new')` (ou outro alvo válido), eliminando o link para a rota inexistente.

### 4. Sanidade dos links "Fábricas" (`Teams.tsx`, `TeamDetails.tsx`, `SuperAdminPanel.tsx`)
Manter o destino `/companies-manage` funcionando: o redirect para `/reports/new` continua válido, e com a correção #1 o `ProjectSelector` passa a aparecer mesmo sem fábricas, então esses links deixam de ter qualquer caso quebrado.

### 5. Verificação final
Após as mudanças, abrir `/reports/new` sem fábricas, criar uma fábrica pelo card "Nova Fábrica", confirmar o toast de sucesso e que a etapa avança para "Unidades". Conferir também os botões "Gerenciar Atividades" em `SiteDashboard` e o link de criação de unidades em `CompanyDashboard`.

## Detalhes técnicos

- Nenhuma mudança de schema/migrations.
- Nenhuma alteração em edge functions.
- Edição apenas em arquivos de UI: `QuickReportWizard.tsx`, `SiteDashboard.tsx`, `CompanyDashboard.tsx`.
- A RLS de `companies` (insert por admin/super_admin) já está em vigor e funciona — o `handleSaveCompany` existente continua o mesmo.
