## Contexto

- **Tela 1 — `/home` (`src/pages/Home.tsx`)**: WelcomeHeader, QuickActions (Criar Relatório, Meus Relatórios, Gerenciar Assinaturas), UserDashboardStats, UserRecentReports, UserProjectsList. Hoje é o destino pós-login de **84 colaboradores**.
- **Tela 2 — `/super-admin` (`src/pages/SuperAdminPanel.tsx`)**: Dashboard com cards das fábricas + Backup. Destino dos 2 super admins.
- O `ProtectedRoute` já redireciona `super_admin` de `/home` → `/super-admin`. Logo, o super admin nunca vê a Tela 1. A redundância real é que **a Tela 1 não é mais a "home" do sistema** — você quer só uma home.

## Decisão proposta

Eliminar a Tela 1 (`/home`) e tornar `/super-admin` a única "home", redirecionando cada papel para o lugar certo:

| Papel | Novo destino pós-login |
|---|---|
| `super_admin` | `/super-admin` (cards de fábricas) |
| `admin` com 1 unidade | `/sites/:id/dashboard` (já era) |
| `admin` com várias | `/super-admin` (mesmos cards de fábricas) |
| `collaborator` | `/reports` (lista dos relatórios dele — é o que ele mais usa; as ações de "Criar Relatório", "Meus Relatórios" e "Gerenciar Assinaturas" já estão acessíveis pela sidebar/bottom-nav) |

> Se preferir outro destino para colaborador (`/reports/new`, `/admin/signatures`, etc.), me diga antes de eu implementar.

## Alterações

### 1. Roteamento (`src/App.tsx`)
- Remover `import Home`.
- Trocar `<Route path="/home" element={<Home />} />` por um componente `HomeRedirect` que lê `role` + `useAdminSiteAccess` e faz `<Navigate>` para o destino correto.
- Manter o fallback `"/admin/*" → "/home"` apontando para `/home` (que agora só redireciona).

### 2. `src/components/ProtectedRoute.tsx`
- Remover a lógica específica de `/home` (super_admin e admin), pois passa toda para o `HomeRedirect`.

### 3. Arquivos deletados
- `src/pages/Home.tsx`
- `src/components/home/WelcomeHeader.tsx`
- `src/components/home/QuickActions.tsx`
- `src/components/home/UserDashboardStats.tsx`
- `src/components/home/UserRecentReports.tsx`
- `src/components/home/UserProjectsList.tsx`
- `src/components/home/StatsCards.tsx`
- `src/components/home/CompanyCard.tsx`
- `src/components/home/ProjectCard.tsx`
- `src/components/home/SiteCard.tsx`
- `src/components/home/index.ts`
- Pasta `src/components/home/` inteira

Antes de excluir cada um, confirmar via `rg` que não há import fora de `Home.tsx`.

### 4. Sidebar / MobileSidebar / BottomNav
- Manter links "Início" apontando para `/home` (o redirect cuida do resto) — sem alteração visual.

## Verificação após implementar

1. Login como super_admin → cai em `/super-admin`.
2. Login como collaborator → cai em `/reports`.
3. Clicar "Início" na sidebar funciona para ambos.
4. Build sem erros de import órfão.
