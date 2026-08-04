# Botão Voltar mais perto das pastas e documentos

## Objetivo
Hoje, na lista de RDOs de uma atividade, o botão voltar fica no topo e os cards de estatísticas (Total / Assinados / Parciais / Pendentes) ficam entre ele e os documentos. Isso obriga o usuário a subir a tela para voltar.

## Mudanças
1. `src/pages/client/ClientActivityList.tsx`: mover o cabeçalho com a seta de voltar (seta + ícone + nome da atividade) para logo acima da grade de documentos, ou seja, depois dos cards de estatísticas. Assim a seta fica colada nos RDOs.
2. `src/pages/client/ClientDashboard.tsx` (visão de mês): o cabeçalho com a seta já fica acima da grade de pastas; apenas reduzir o espaçamento entre eles para reforçar a proximidade.
3. `src/pages/client/ClientReports.tsx`: aplicar o mesmo posicionamento (seta imediatamente acima da lista/grade de relatórios) para manter consistência.

## Detalhes técnicos
- Sem mudanças de lógica, dados ou rotas; apenas reordenação de blocos JSX e ajuste de classes de espaçamento (`space-y`, `py`).
- O componente `PageBackHeader` permanece igual (seta redonda + badge de ícone + título), sem duplicar botões de voltar na mesma tela.