# Alerta de divergência de OM ao criar RDO

## Problema
O wizard recebe `omNumber`/`omTitle` da pasta de origem (card clicado em "Meus RDOs"), mas o usuário pode selecionar outra fábrica/atividade nos passos seguintes. Hoje o RDO é salvo silenciosamente em outro destino, criando cards órfãos.

## O que será feito

1. **Comparação de contexto x destino**
   Ao concluir a seleção no wizard, comparar o contexto recebido na navegação (OM e título de origem) com o que foi efetivamente selecionado:
   - OM diferente (número normalizado, ignorando espaços/zeros à esquerda);
   - OM ausente no destino quando havia OM na origem;
   - título de atividade divergente (usando a mesma normalização já usada no agrupamento de pastas).

2. **Aviso visível durante a seleção**
   Enquanto houver divergência, exibir um banner de alerta no topo do seletor: "Este RDO será salvo em outra atividade (X) e não na pasta de origem (Y)."

3. **Confirmação antes de avançar**
   Se houver divergência ao clicar em continuar, abrir um diálogo com duas opções:
   - "Manter pasta de origem" — mantém OM/título originais no novo RDO;
   - "Salvar na atividade selecionada" — segue com o destino escolhido.
   Sem divergência, o fluxo continua direto, sem diálogo extra.

4. **Propagação coerente**
   O estado enviado ao formulário passa a refletir exatamente a escolha do usuário no diálogo, em vez de misturar OM do contexto com título do destino (comportamento atual da linha que faz `data.omNumber || initialData?.omNumber`).

## Detalhes técnicos
- `src/pages/QuickReportWizard.tsx`: guarda o contexto de origem, faz a comparação em `handleSelectionComplete`, renderiza o `AlertDialog` de confirmação e só então navega para `/reports/create/:projectId` com o estado final.
- `src/components/reports/ProjectSelector.tsx`: nova prop opcional (ex.: `mismatchWarning`) para renderizar o banner de alerta acima dos passos; sem alteração na lógica de seleção.
- Normalização reaproveitada de `src/lib/rdoActivityGroups.ts` (`omTitleTokens` / normalização de OM) para evitar falsos positivos por acentos, caixa e pontuação.
- Nenhuma mudança de banco de dados ou de edge function.
