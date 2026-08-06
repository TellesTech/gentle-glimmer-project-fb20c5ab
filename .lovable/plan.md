# Corrigir pastas de atividade no Portal do Cliente

## Problema (confirmado)

1. **Nomes das pastas errados.** No `ClientDashboard`, as consultas de RDO buscam `location`, `maintenance_order_number` e `maintenance_order_title` no banco, mas ao montar o objeto `report` esses campos são descartados (tanto na visão admin quanto na visão cliente). O agrupamento então recebe esses campos como `undefined` e cai na chave `project:<uuid>`, exibindo o nome bruto do projeto ("CAC", "Limpeza das torres linha 3 e 4 Branqueamento B") em vez de `OM <número> — <título>`.
   Verificação no banco (unidade Suzano Aracruz): existem RDOs com OM real, ex. `22461261 — Transportadora 09` (7 RDOs), `4502439978 — Tratamento mecânico e pintura...`, `16200413 — Inspeção e retirada de concreto...`.

2. **RDOs "sumiram" ao abrir a pasta.** O dashboard monta os grupos **por mês** e sobre o conjunto de RDOs daquela unidade; a tela `ClientActivityList` refaz o agrupamento sobre **todos os meses** e sobre **todas as unidades** do usuário. Como a fusão de títulos semelhantes e as chaves dependem do conjunto de entrada, o `id` do grupo vindo da URL frequentemente não existe no agrupamento refeito, e a tela mostra "Nenhum RDO desta atividade está disponível para você".

## Correção

### 1. Preservar os campos de OM no dashboard
Nas duas consultas (`admin-client-dashboard-reports` e `client-dashboard-reports`), incluir `location`, `maintenance_order_number` e `maintenance_order_title` no objeto `report` retornado, e tipar isso em `PendingReport`. Assim as pastas passam a exibir `OM 22461261 — Transportadora 09`.

### 2. Tornar o agrupamento da lista idêntico ao do dashboard
Passar o escopo na URL ao abrir a atividade: além do `company_id`/`site_id` já existentes, incluir `year` e `month` da pasta aberta.
Em `ClientActivityList`:
- Buscar os RDOs usando exatamente o mesmo escopo de unidade do dashboard (respeitando o `site_id` da URL na visão admin, em vez de todas as unidades permitidas).
- Filtrar pelo mês/ano recebidos antes de chamar `buildActivityGroups`, reproduzindo o mesmo conjunto de entrada.
- Manter o fallback por UUID de projeto para links antigos.

### 3. Coerência de status e meses ocultos
Aplicar na lista o mesmo filtro de meses ocultos usado no dashboard, para que a contagem da pasta e a quantidade de RDOs abertos batam.

### 4. Limpeza
Remover o log de debug e a linha de diagnóstico ("IDs de relatórios vinculados") adicionados na tentativa anterior.

## Detalhes técnicos

- `src/pages/client/ClientDashboard.tsx`: incluir os 3 campos no mapeamento de `report` (linhas ~227 e ~302); acrescentar `year`/`month` ao `navigate` do card de atividade.
- `src/pages/client/ClientActivityList.tsx`: ler `site_id`, `year`, `month` de `useSearchParams`; ajustar a resolução de unidades e o filtro de período antes de `buildActivityGroups`.
- `src/lib/rdoActivityGroups.ts`: sem alterações.
- Sem alterações de banco de dados ou de RLS.
