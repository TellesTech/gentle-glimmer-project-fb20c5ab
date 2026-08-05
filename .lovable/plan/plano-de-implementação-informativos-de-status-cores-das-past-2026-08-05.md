# Plano de Implementação - Informativos de Status (Cores das Pastas)

O usuário solicitou a inclusão de informativos para explicar por que as pastas no portal do cliente têm cores diferentes (vermelho para pendente, amarelo para parcial/concluído).

## Alterações Propostas

### 1. Componente `ClientDashboard` (`src/pages/client/ClientDashboard.tsx`)
- Adicionar uma legenda de cores (informativo) logo acima da grade de pastas de atividades (quando um mês está selecionado).
- A legenda explicará:
  - **Pasta Amarela**: Atividades com RDOs assinados ou em andamento.
  - **Pasta Vermelha**: Atividades com RDOs pendentes de assinatura.

### 2. Componente `ClientActivityList` (`src/pages/client/ClientActivityList.tsx`)
- Adicionar uma legenda semelhante para os ícones de "folha de papel" (RDOs individuais).
- Explicar o significado das faixas de status nos documentos:
  - **Verde**: Assinado.
  - **Amarelo**: Assinatura parcial.
  - **Vermelho**: Pendente.

## Design System
- Utilizar o componente `Badge` ou pequenos círculos de cor com texto `text-xs` para manter a interface limpa e profissional, seguindo o padrão já existente no portal.
- Posicionar de forma discreta, mas visível, próximo ao título da seção de arquivos/pastas.

## Verificação
- Validar visualmente se os informativos estão claros e não poluem a interface.
- Garantir que as cores mencionadas na legenda correspondam exatamente às cores aplicadas logicamente nos componentes.
