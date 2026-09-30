# Voltar para a Agenda depois de salvar o RDO

## Problema
Ao criar um RDO a partir da Agenda e salvar, a tela não volta para a Agenda — cai em "Meus RDOs" ou em outra tela.

Cenário de uso: criar vários RDOs da semana em sequência. Cada vez que salvar, deve voltar para a Agenda (no mesmo mês), pronta para clicar no próximo dia e fazer outro RDO, e o novo RDO já aparecer no dia salvo.

## Causa confirmada
- Em `src/pages/SimplifiedReportForm.tsx` (linha ~563), depois de salvar o código usa `goBackOr(originFrom || '/reports?...')`. O `goBackOr` (`src/hooks/useSmartBack.ts`) faz `navigate(-1)` quando existe histórico — mas se houve qualquer navegação intermediária (recarga, aba de turno, diálogo), o `-1` não leva à Agenda; e sem histórico ele cai no fallback `/reports` (Meus RDOs), ignorando a Agenda de origem.
- O botão "Novo Relatório" da pasta de atividade (`src/components/reports/DocumentCabinet.tsx`, linha ~1438) navega para `/reports/new` sem registrar a página de origem (`state.from`).

## O que será feito

1. **Salvar → voltar para a origem** (`SimplifiedReportForm.tsx`):
   - Depois de salvar um RDO novo, navegar diretamente para `location.state.from` (a Agenda, com mês/ano) quando ele existir, usando `replace` para não empilhar telas.
   - Só usar `navigate(-1)` quando não houver `from` registrado.
   - Manter o fallback atual (`/reports?company=...&site=...&year=...&month=...`) quando não houver origem nenhuma.

2. **Registrar a origem no botão da pasta** (`DocumentCabinet.tsx`):
   - Incluir `from: location.pathname + location.search` no `state` do botão "Novo Relatório", para que salvar também volte para a pasta de onde se saiu.

3. **Edição de RDO** (mesma tela, fluxo de atualização): aplicar a mesma regra — após salvar, voltar para a página de origem quando registrada.

## Verificação
- `bunx tsgo --noEmit` sem erros.
- Pedir ao usuário para confirmar: Agenda → Novo RDO → Salvar → volta para a Agenda no mesmo mês; e pasta de atividade → Novo Relatório → Salvar → volta para a pasta.
