# Corrigir botão de download sobreposto no card do RDO

## Problema
Na pasta da atividade, o botão de opções/download do card do RDO está posicionado de forma absoluta no canto superior direito (`DocumentCabinet.tsx`, linha ~1467), por cima do título "RDO Nº ..." e da seta do card, como mostra a captura enviada.

## Correção

### `src/components/reports/DocumentCabinet.tsx` (card do RDO, ~linhas 1464–1493)
- Reservar espaço para o botão em vez de deixá-lo por cima do conteúdo:
  - Adicionar margem à direita no cabeçalho do card (`pr-8` na linha do título "RDO Nº ..."), para o texto nunca passar por baixo do botão.
  - Manter o botão no canto superior direito com fundo sólido (`bg-card`/`bg-background` e borda) para não vazar visualmente sobre os selos de status abaixo.
- Conferir também o outro bloco absoluto em ~linha 1634 (card de outra pasta/mês) e aplicar a mesma margem se houver texto embaixo.

### Validação
- Abrir a pasta de uma atividade (ex.: OM 4600039631) e conferir que o botão não cobre mais o título nem a seta, em tela larga e estreita.
- Confirmar que o menu continua abrindo com "Baixar PDF" e "Baixar em branco para assinar".

## Sem alterações
- Nada de banco de dados ou funções de servidor.
- A lista de Relatórios (`Reports.tsx`) já tem o botão no fluxo normal do card, sem sobreposição — não será tocada.
