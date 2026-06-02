## Objetivo
Quando a planilha importada tiver mais de uma aba, permitir que o usuário escolha qual aba enviar para análise antes do processamento.

## Mudanças

**`src/components/users/ImportCollaboratorsDialog.tsx`**

1. Adicionar novo estado `'selectSheet'` ao tipo `Step`.
2. Ao carregar o arquivo em `parseFile`:
   - Carregar o workbook com ExcelJS normalmente.
   - Se `workbook.worksheets.length === 1` (ou CSV) → manter fluxo atual (vai direto para análise).
   - Se houver 2+ abas → guardar o workbook em estado, listar os nomes das abas e ir para o step `'selectSheet'`.
3. Nova UI no step `'selectSheet'`:
   - Lista de abas (RadioGroup) mostrando nome e quantidade de linhas de cada uma.
   - Botões "Cancelar" e "Continuar" no footer.
   - Ao confirmar, extrai os dados apenas da aba escolhida e segue para `'analyzing'` + envio à edge function (mesma lógica de hoje).
4. `resetDialog` limpa também o workbook e a aba selecionada.

## Comportamento
- Planilha com 1 aba ou CSV: fluxo idêntico ao atual (nenhuma tela extra).
- Planilha com várias abas: tela intermediária para escolher a aba antes de enviar à IA.
- Nenhuma mudança na edge function `import-collaborators`.
