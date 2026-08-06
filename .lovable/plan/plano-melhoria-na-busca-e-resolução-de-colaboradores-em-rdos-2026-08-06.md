# Plano: Melhoria na Busca e Resolução de Colaboradores em RDOs

O usuário relatou problemas na seleção/puxada de colaboradores ao criar RDOs. Após análise, identifiquei que a busca manual no `StepAttendance` já utiliza `stripAccents`, mas o `ParseReportModal` (utilizado para processar textos do WhatsApp) pode ser otimizado para lidar melhor com variações de nomes e garantir que todos os perfis ativos sejam considerados.

## Problemas Identificados
1. **Contexto de Equipe**: Se uma equipe não estiver selecionada, o `StepAttendance` pode não carregar membros automaticamente, dependendo apenas da busca manual.
2. **Sensibilidade a Acentos em AI**: O `matchCollaborator` no `ParseReportModal` (usado na interpretação de texto) pode falhar se os nomes no texto tiverem erros de digitação sutis ou se o banco de dados tiver duplicatas/nomes similares.
3. **Escopo de Busca**: Garantir que a lista de `allProfiles` em `ReportForm.tsx` traga todos os colaboradores necessários, independentemente da empresa (respeitando RLS).

## Ações Propostas

### 1. Reforçar o Match de Colaboradores (Interpretador de Texto)
- Atualizar `src/components/reports/ParseReportModal.tsx` para usar uma normalização mais agressiva e tolerante no `matchCollaborator`.
- Incluir `stripAccents` de forma consistente em todas as etapas de comparação do parser.

### 2. Otimizar Busca no UI
- Verificar se `StepAttendance` está recebendo a lista completa de perfis em `ReportForm.tsx`.
- Garantir que o `CommandInput` do shadcn não esteja filtrando localmente de forma conflitante com o filtro manual de `stripAccents`.

### 3. Debug de Performance de Busca
- Adicionar logs (opcional, para ambiente de dev) ou melhorar o feedback visual quando um colaborador é "Adicionado manualmente" vs "Identificado no banco" no parser de texto.

### 4. Verificação de Dados
- Confirmar se usuários como "Christiano Serra da Silva" e "Fábio Carvalho Braga" estão corretamente associados às empresas/projetos para serem visíveis no contexto do RDO que está sendo criado.

## Arquivos a serem modificados:
- `src/components/reports/ParseReportModal.tsx`: Melhorar lógica de match.
- `src/components/reports/StepAttendance.tsx`: Ajustar comportamento do seletor.
- `src/pages/ReportForm.tsx`: Garantir que `allProfiles` carregue dados suficientes.
