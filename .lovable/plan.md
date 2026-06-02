## Objetivo
Evitar erro ao salvar o RDO quando o usuário preenche horas de desvio (operacional/climático/AMT) no formato `HH:MM`, já que as colunas no banco são `numeric`.

## Mudanças
Arquivo: `src/pages/SimplifiedReportForm.tsx`

1. Adicionar helper `hhmmToDecimal(value: string): number | null` ao lado do `formatHHMM` existente:
   - Aceita string `HH:MM` ou número já decimal
   - Retorna `null` para string vazia/inválida
   - Retorna `horas + minutos/60` como número

2. Nas duas mutations (create em ~L324-330 e update em ~L527-533), converter antes do insert/update:
   - `operational_deviation_hours: hhmmToDecimal(data.operationalDeviationHours)`
   - `climatic_deviation_hours: hhmmToDecimal(data.climaticDeviationHours)`
   - `amt_deviation_hours: hhmmToDecimal(data.amtDeviationHours)`

3. Leitura (linhas ~210-216): já existe `existingReport.operational_deviation_hours?.toString().slice(0, 5)` — substituir por `formatHHMM(Number(existingReport.operational_deviation_hours))` quando o valor não for nulo, para exibir corretamente `HH:MM` a partir do decimal.

## Não muda
- Banco de dados (estrutura já está correta após a última migration)
- `workforce_delays` (já converte corretamente)
- Demais campos do formulário

## Validação
Após a alteração: criar um RDO com hora de desvio `00:30` preenchida e confirmar que salva sem erro e que ao reabrir o relatório o valor aparece como `00:30`.