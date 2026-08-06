# Plan: Corrigir Vínculo de Função e Filtro de Colaboradores no RDO

O usuário relatou dois problemas na criação de RDO:
1. A função (job title) dos colaboradores não está sendo carregada corretamente ao adicioná-los (ex: Sergio dos Santos).
2. A busca de colaboradores no formulário parece estar restrita a quem já está vinculado à unidade/projeto, dificultando a adição de novos membros da base geral.

## Alterações Propostas

### 1. Componentes de Formulário (`StepAttendance.tsx` e `QuickReportFormContent.tsx`)
- **Problema de Função:** No `QuickReportFormContent.tsx`, ao adicionar um colaborador via busca (`addCollaborator`), a função está sendo definida como "Convencional" por padrão se não houver match exato ou se o campo `jobTitle` não for passado corretamente. No `StepAttendance.tsx`, a lógica de inicialização e atualização também pode estar perdendo o `jobTitle`.
- **Problema de Filtro:** Aumentar a abrangência da busca para garantir que colaboradores ativos de outras unidades (que o usuário tenha permissão de ver) apareçam, removendo filtros restritivos que possam estar limitando os resultados apenas ao projeto atual na interface de busca.

### 2. Sincronização de Perfis
- Garantir que o `jobTitle` (função) seja sempre extraído da tabela `profiles` e preservado no estado `attendance` do formulário.
- Adicionar logs de depuração (opcional/temporário) ou melhorar a lógica de `useEffect` que reconcilia os nomes e funções dos perfis carregados.

## Arquivos a serem modificados
- `src/components/reports/StepAttendance.tsx`: Melhorar `addCollaborator` e a filtragem.
- `src/components/reports/QuickReportFormContent.tsx`: Ajustar `addCollaborator` para garantir que o `jobTitle` seja passado e exibido corretamente.

## Verificação
- Testar a busca por "Sergio" e "Douglas" (mencionados pelo usuário) no formulário.
- Confirmar se a função "PINTOR ESCALADOR N1" ou similar aparece automaticamente.
- Verificar se colaboradores que não pertencem ao time atual aparecem na busca global do modal.
