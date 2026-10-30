# Corrigir o "Voltar" na criação do RDO

## Problema
Na primeira tela de criação do RDO (escolha de fábrica/unidade/atividade), o botão do topo sempre leva para a lista de Relatórios (o "início"), mesmo quando você veio da Agenda, de uma pasta ou de outro painel.

## O que vai mudar
- O botão do topo da primeira etapa passa a se chamar **"Voltar"** e retorna à tela de onde você veio (Agenda, pasta, painel...).
- Se a página foi aberta direto por link ou recarregada, volta para Relatórios (como hoje).
- Nas etapas seguintes o "Voltar" continua indo para a etapa anterior.
- No formulário do RDO, o "Voltar" volta para a tela de escolha; se você tiver vindo com tudo já preenchido (ex.: pela pasta), volta direto para a origem, sem ficar preso em ida e volta.

## Detalhes técnicos
- `src/components/reports/ProjectSelector.tsx`: trocar `navigate('/reports')` da etapa 1 por `useSmartBack('/reports')`.
- `src/pages/QuickReportWizard.tsx`: ao navegar para o formulário quando a seleção vem pré-preenchida, usar `replace: true` para que o voltar do formulário não caia no seletor que reencaminha.
- Conferir com Playwright o fluxo Agenda → Novo RDO → Voltar.
