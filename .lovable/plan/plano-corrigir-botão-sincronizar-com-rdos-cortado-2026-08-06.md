# Plano: Corrigir botão “Sincronizar com RDOs” cortado

## Objetivo
Garantir que o botão **Sincronizar com RDOs** apareça inteiro dentro do card de filtros da Base de Dados, sem ultrapassar ou ser cortado na lateral direita.

## Alteração
- Ajustar o contêiner dos botões **Importar Planilha** e **Sincronizar com RDOs** para respeitar sempre a largura disponível.
- Permitir reorganização responsiva: lado a lado quando houver espaço e empilhados quando a largura for insuficiente.
- Aplicar limites de largura e redução correta dos elementos para impedir overflow horizontal, mantendo texto e ícones legíveis.
- Preservar as ações, permissões e estados de carregamento existentes.

## Verificação
- Conferir a Base de Dados no viewport atual e em uma largura menor.
- Confirmar visualmente que o botão fica totalmente dentro do card e que os dois botões continuam clicáveis.

## Detalhes técnicos
- Arquivo: `src/pages/WorkforceDatabase.tsx`
- Mudança somente no layout responsivo do grupo de ações; nenhuma regra de sincronização será alterada.