# Plano de Correção: Sincronização de Atividades na Base de Dados

O usuário relatou que algumas atividades visíveis em "Meus RDOs" (como as relacionadas a "Transportadora") não estão aparecendo no campo de busca da "Base de Dados", mesmo após a implementação da lógica de nomes aprimorados.

## Diagnóstico
A análise inicial do `WorkforceDatabase.tsx` mostra que:
1. A busca utiliza `searchString` que compõe `displayName`, `name`, `location`, `maintenance_order_title`, `site` e `company`.
2. O `displayName` e a `searchString` são gerados baseados apenas no **primeiro** relatório retornado pela query do Supabase (`reports(location, maintenance_order_title)`).
3. Se uma "Atividade/Projeto" possui múltiplos relatórios com títulos de OM ou localizações diferentes (ex: um RDO de "Transportadora 01" e outro de "Manutenção"), a lógica atual pode estar capturando apenas um deles, ignorando termos de busca dos outros.

## Ações Propostas

### 1. Melhorar a captura de metadados dos projetos
Alterar `loadProjects` e `loadRecords` no arquivo `src/pages/WorkforceDatabase.tsx` para:
- Coletar **todos** os títulos de OM e localizações únicos associados a um projeto, em vez de apenas o primeiro.
- Expandir a `searchString` para incluir todos esses termos, garantindo que buscas por "Transportadora" funcionem se qualquer RDO do projeto contiver esse termo.

### 2. Refinar a Identificação de Nomes Genéricos
Garantir que projetos com nomes genéricos (como "*") exibam um nome mais representativo baseado no conjunto de relatórios vinculados.

## Verificação
1. Validar se ao digitar "Transportadora" no Combobox de atividades da Base de Dados, os projetos correspondentes são listados.
2. Confirmar se a lista de projetos filtrada por Fábrica continua funcionando corretamente.

---
Deseja que eu siga com essas alterações no código?
