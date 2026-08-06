# Plano: Corrigir Vínculo de Função e Filtro de Colaboradores no RDO (Revisado)

O usuário relatou que na criação de RDO:
1. A função (ex: "PINTOR ESCALADOR N1") não está sendo carregada corretamente ao adicionar o colaborador.
2. A busca de colaboradores no formulário de RDO está restrita a quem já faz parte do time ou unidade, impedindo a seleção de outros colaboradores da base.

## Alterações Propostas

### 1. Garantir Vínculo de Função (Job Title)
- **Componentes:** `StepAttendance.tsx` e `QuickReportFormContent.tsx`.
- **Ação:** No `QuickReportFormContent.tsx`, a função `addCollaborator` será ajustada para garantir que o `jobTitle` vindo do objeto `profile` seja atribuído corretamente ao campo `functionRole` no estado de attendance.
- **Ação:** No `StepAttendance.tsx`, assegurar que a inicialização de colaboradores adicionais via busca também preserve o `jobTitle`.

### 2. Abrir a Busca para Todos os Colaboradores
- **Problema Identificado:** No `QuickReportFormContent.tsx`, a busca `allProfiles` já parece buscar todos os perfis ativos, mas a interface e o estado `availableProfiles` podem estar filtrando de forma agressiva ou a query pode estar sendo limitada por RLS (Row Level Security).
- **Ação:** Revisar a query de `all-profiles-quick` no `QuickReportFormContent.tsx` e `all-profiles-attendance` no `ReportForm.tsx` para garantir que não haja filtros ocultos por empresa/unidade que impeçam a visualização de colaboradores que deveriam estar disponíveis para alocação.
- **Ação:** No frontend, remover qualquer lógica que filtre `availableProfiles` apenas para membros do projeto atual, permitindo a busca global.

## Arquivos a serem modificados
- `src/components/reports/QuickReportFormContent.tsx`: Ajustar `addCollaborator` e query de busca.
- `src/components/reports/StepAttendance.tsx`: Ajustar `addCollaborator` e query de busca.
- `src/pages/ReportForm.tsx`: Ajustar a query de perfis globais.

## Verificação
- Testar a busca por "Sergio" e "Douglas" e verificar se a função correta é preenchida automaticamente.
- Validar se colaboradores de outras unidades aparecem na lista de busca.
