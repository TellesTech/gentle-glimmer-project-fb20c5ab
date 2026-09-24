# Corrigir o botão "Novo Relatório" dentro da pasta de atividade

## Causa confirmada
O botão "Novo Relatório" no cabeçalho da pasta de atividade (tela Meus RDOs) leva para um endereço que não existe no sistema (`/reports/wizard`). Por isso nada acontece / cai numa página vazia. Todos os outros botões "Novo Relatório" / "Criar RDO" (topo de Meus RDOs, menu lateral, barra inferior, painéis de fábrica/unidade, portal do cliente) usam o endereço correto (`/reports/new`) e foram conferidos.

## O que será feito
1. Pasta de atividade: trocar o destino do botão para a tela correta de criação de RDO, mantendo fábrica, unidade, número e título da OM já preenchidos, para o novo RDO cair na mesma pasta.
2. Enviar também a atividade da pasta, para que o assistente de criação já venha com ela selecionada.
3. Conferir os demais botões de criação (topo da tela, menu lateral, barra do celular, painel da unidade/fábrica, portal do cliente) clicando em cada um no navegador de teste para confirmar que todos abrem a tela de criação.

## Detalhes técnicos
- `src/components/reports/DocumentCabinet.tsx` (~L1439): `navigate('/reports/wizard', …)` -> `navigate('/reports/new', …)`; incluir `projectId` da pasta (`selectedProjectFolder.sourceProjects[0]?.id` ou prefixo `project:`) no `state`.
- `src/pages/QuickReportWizard.tsx`: aceitar `projectId` do `state` e repassar em `initialData`, além de repassar `omTitle` (hoje só `omNumber` vai em `initialData`).
- Limpeza sem efeito visual: em `BottomNav.tsx` a checagem `isNewButton` compara com `/reports/quick` (inexistente); ajustar para `/reports/new` para o botão "Novo" ganhar o destaque previsto.
