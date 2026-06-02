## Problema

Existem dois diálogos diferentes para fábrica:

1. **Completo** (`ProjectSelector.tsx`, linhas 2007‑2221): foto, nome, CNPJ, Nº contrato, telefone, email, endereço (rua/cidade/UF/CEP), Cliente Ativo, Responsável Principal, Observações. Usado em `/reports/new`.
2. **Reduzido** (`SuperAdminPanel.tsx`, linhas 555‑587): só Nome + CNPJ. Disparado pelo lápis do card de fábrica em `/super-admin`.

Quando o super admin clica em "Editar" no card, abre só o reduzido — perdendo todos os outros campos da fábrica.

## Solução

Extrair o formulário completo num componente reutilizável e usar nos dois lugares.

### 1. Criar `src/components/companies/CompanyFormDialog.tsx`
Componente isolado que recebe:
- `open`, `onOpenChange`
- `companyId?: string | null` (null/undefined = criar; preenchido = editar)
- `onSaved?: () => void` (callback de refetch)

Internamente:
- Se `companyId` presente, carrega o registro completo de `companies` no `useEffect` quando o dialog abre, e popula o estado do form.
- Reaproveita exatamente o mesmo JSX/markup do bloco atual em `ProjectSelector.tsx` (foto, dados, endereço, switch Cliente Ativo, responsável, observações).
- `handleSave` faz `update` quando há `companyId` e `insert` quando não há, com o mesmo payload usado hoje no ProjectSelector.
- Mostra toasts de sucesso/erro coerentes.

### 2. Substituir o diálogo reduzido em `SuperAdminPanel.tsx`
- Remover bloco `Edit Company Dialog` (linhas 554‑587), estado `editForm`, `handleSaveCompany` e `setEditDialogOpen`.
- Trocar por `<CompanyFormDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} companyId={selectedCompany?.id ?? null} onSaved={fetchStats} />`.
- `handleEditCompany` passa a só setar `selectedCompany` + abrir.

### 3. Trocar o card "Nova Fábrica" em `/super-admin`
Hoje ele faz `navigate('/companies-manage')` (que redireciona para `/reports/new`). Trocar para abrir o `CompanyFormDialog` sem `companyId` no próprio `/super-admin`, mantendo o usuário na tela.

### 4. (Opcional, mesma PR) Atualizar `ProjectSelector.tsx`
Substituir o JSX inline (linhas 2007‑2221) por `<CompanyFormDialog ... />`, removendo `companyFormData`, `initialCompanyFormData`, `handleSaveCompany`, etc. Isso elimina duplicação e mantém um único ponto de manutenção.

## Verificação

1. Em `/super-admin`, clicar lápis em "Aperam" → abre dialog com todos os campos preenchidos da fábrica.
2. Editar e salvar → toast OK + card atualizado.
3. Clicar "+ Nova Fábrica" no super-admin → mesmo dialog vazio, cria a fábrica.
4. Em `/reports/new`, criar/editar fábrica continua funcionando exatamente igual.
