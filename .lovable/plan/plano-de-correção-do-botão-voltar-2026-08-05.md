# Plano de Correção do Botão "Voltar"

O usuário relatou que, ao clicar no botão "Voltar", a página não retorna para a anterior conforme esperado. Identifiquei que em algumas telas do portal do cliente, a lógica de retorno está fixa ou depende do `window.history.back()`, o que pode falhar se o usuário entrar via link direto ou se o histórico for limpo. Além disso, a padronização visual precisa ser garantida.

## Alterações Propostas

### 1. Componente `ClientHeader`
- **Arquivo:** `src/components/client/ClientHeader.tsx`
- **Mudança:** Garantir que o `onBack` sempre utilize a navegação do `react-router-dom` se disponível, ou fornecer um fallback mais robusto para `/client/dashboard` quando estiver no portal do cliente.

### 2. Tela de Visualização de Relatórios do Cliente
- **Arquivo:** `src/pages/ClientReportView.tsx`
- **Mudança:** Atualizar o `onBack` passado para o `ClientHeader`. Atualmente, ele faz `() => window.history.back()` para usuários via link de acesso. Vou alterar para tentar voltar ao dashboard se o usuário estiver autenticado, ou usar `navigate(-1)` com um fallback seguro.

### 3. Tela de Atividades (Lista de RDOs)
- **Arquivo:** `src/pages/client/ClientActivityList.tsx`
- **Mudança:** Verificar a lógica de `onBack` no `PageBackHeader`. Atualmente usa `navigate(\`/client/dashboard?${searchParams.toString()}\`)`. Vou garantir que os parâmetros de busca sejam preservados corretamente para manter o filtro de empresa/unidade.

### 4. Tela de Histórico de Relatórios (Assinados)
- **Arquivo:** `src/pages/client/ClientReports.tsx`
- **Mudança:** O `PageBackHeader` nesta tela tem uma lógica aninhada de estados (Month -> Year -> Activity -> Root). Vou garantir que o botão de voltar no nível raiz do dashboard do cliente (quando não há atividade selecionada) não cause loops ou comportamentos inesperados.

### 5. Padronização do `PageBackHeader`
- **Arquivo:** `src/components/client/PageBackHeader.tsx`
- **Mudança:** Garantir que a ação de clique no botão utilize `e.preventDefault()` e `e.stopPropagation()` para evitar comportamentos indesejados em componentes pai.

## Verificação
1. Abrir o portal do cliente.
2. Navegar entre pastas de meses, atividades e detalhes de RDO.
3. Clicar no botão "Voltar" em cada nível e verificar se a navegação sobe um nível na hierarquia corretamente.
4. Testar o acesso via link direto (mágica) e verificar se o botão "Voltar" leva ao dashboard ao invés de ficar travado.
