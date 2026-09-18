# Corrigir a coluna ATIVIDADE da planilha da Base de Dados

## Resultado esperado
A coluna **ATIVIDADE** deve mostrar o mesmo valor exibido no campo **Atividade** dentro de cada RDO. No exemplo enviado, o valor correto é **CRA PE**, e não o nome do card ou da pasta.

## Diagnóstico confirmado
- Na página do RDO, o campo **Atividade** usa primeiro o **Local de Atividade** do relatório (`location`), depois o título da OM e, por último, o nome da atividade cadastrada.
- A Base de Dados atualmente substitui esse valor pelo nome do agrupamento/card antes de gerar o Excel, causando a divergência.
- A consulta de presença usada pela Base de Dados ainda não traz o local e o título da OM necessários para reproduzir o campo mostrado no RDO.

## Alterações
1. Incluir o local e o título da OM na leitura dos RDOs usados pela Base de Dados.
2. Preencher **ATIVIDADE** com a mesma regra da página do RDO:
   - local do RDO, como `CRA PE`;
   - se estiver vazio, título da OM;
   - se também estiver vazio, nome da atividade cadastrada;
   - por último, `Sem atividade`.
3. Manter registros inseridos manualmente com o nome de atividade que já foi informado neles.
4. Aplicar o mesmo valor correto na tabela da Base de Dados e na exportação Excel, evitando diferença entre o que aparece na tela e o arquivo baixado.

## Verificação
- Conferir o RDO nº 005 de 14/09/2026: a coluna deve sair como **CRA PE**.
- Testar RDOs com e sem local preenchido para confirmar os valores alternativos.
- Exportar a planilha e confirmar que nenhum nome de card/pasta substitui a atividade do próprio RDO.
