# Corrigir nome das pastas de atividade

O texto que você digitou no chat foi gravado literalmente dentro do código, substituindo o nome real da atividade. Além disso, o nome verdadeiro estava sendo cortado com reticências.

## O que será feito

1. Restaurar o nome real da atividade nas pastas:
   - Portal do cliente (grade de pastas do mês)
   - Painel administrativo (lista de pastas de atividade)
2. Exibir o nome completo, sem corte:
   - Remover o corte em uma linha (`truncate`)
   - Permitir quebra em várias linhas (até 3 linhas), com quebra de palavras longas
   - Manter tooltip com o nome completo ao passar o mouse
   - Ajustar o espaçamento da grade para acomodar títulos mais altos sem desalinhar as pastas

## Detalhes técnicos

- `src/pages/client/ClientDashboard.tsx`: voltar o texto para `{a.name}`, trocar `truncate` por `line-clamp-3 break-words leading-snug`, adicionar `title={a.name}` e alinhar os itens da grade pelo topo (`items-start` no container do card).
- `src/components/reports/DocumentCabinet.tsx`: voltar o texto para `{projectFolder.name}`, trocar `truncate` por `line-clamp-3 break-words leading-snug` mantendo o `title` existente.
