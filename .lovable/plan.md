## Diagnóstico

A tela **Base de Dados HH** não está puxando as informações por dois motivos encontrados:

1. A consulta de mão de obra tenta buscar a coluna `report_attendance.function_role`, mas essa coluna não existe no banco atual. Isso gera erro 400 e interrompe a carga automática dos dados dos RDOs.
2. O período selecionado na tela está em junho/2026, mas o último RDO existente no banco é de **15/05/2026**. Então, mesmo corrigindo a consulta, junho continuará vazio até existir RDO nesse período.

Também confirmei que a tabela `report_attendance` está vazia no banco atual. Para RDOs antigos, a tela só conseguirá exibir mão de obra detalhada se houver registros de presença salvos; caso contrário, só poderá exibir os totais existentes no próprio RDO (`planned_workforce` e `actual_workforce`).

## Plano de correção

1. **Corrigir a consulta da Base de Dados HH**
   - Remover `function_role` da seleção em `src/pages/WorkforceDatabase.tsx`.
   - Manter a resolução de função usando `profiles.job_title`, `user_id` e nome do trabalhador.
   - Usar função padrão quando a função não existir no RDO.

2. **Corrigir outras consultas quebradas que também usam `report_attendance.function_role`**
   - Ajustar `src/components/workforce/WorkforceAITab.tsx` para não depender dessa coluna inexistente.
   - Revisar pontos relacionados para evitar novos erros 400 na aba de IA/previsões.

3. **Melhorar o estado vazio da tela**
   - Quando não houver registros no período, manter o alerta com o último RDO encontrado.
   - Deixar mais claro que o período atual não tem RDOs e que o botão “Ir ao último RDO” deve carregar o mês correto.

4. **Validar o resultado**
   - Verificar se a tela deixa de fazer requisição com `function_role` em `report_attendance`.
   - Confirmar que a Base de Dados HH não quebra mais com erro 400.
   - Confirmar que, ao ir para maio/2026 ou para o mês do último RDO, os dados disponíveis são carregados corretamente.

## Observação importante

Se a expectativa é aparecer a lista detalhada de colaboradores por RDO, será necessário existir dado em `report_attendance`. Hoje essa tabela está com **0 registros** no banco atual. Essa correção resolve o erro de carregamento; recuperar mão de obra detalhada antiga depende de migração/importação desses registros ou de extrair novamente dos RDOs originais.