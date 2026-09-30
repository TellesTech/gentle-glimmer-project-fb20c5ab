# Consertar o "Voltar" que fica preso na mesma página

## O que está acontecendo
O "Voltar" de baixo (na página do RDO) e o "Voltar" da Agenda às vezes parecem não funcionar: a pessoa clica e continua na mesma tela, ou volta para uma tela que já tinha fechado. Isso acontece porque algumas ações colocam uma cópia da página no histórico em vez de voltar de verdade:

1. **Voltar da criação de RDO:** em vez de voltar, o sistema abre a Agenda de novo. O histórico fica Agenda → Criação → Agenda. Depois, o "Voltar" da Agenda leva de novo para a criação.
2. **Salvar um RDO novo:** a criação é trocada por outra cópia da Agenda. O histórico fica Agenda → Agenda, e o "Voltar" da Agenda não sai do lugar.
3. **Salvar a edição de um RDO:** a edição é trocada por outra cópia da página do RDO. O histórico fica RDO → RDO, e o "Voltar" de baixo parece não fazer nada.
4. **Abas de RDOs do mesmo dia (na página do RDO):** cada troca de aba entra no histórico. Assim, o "Voltar" passa pelas abas uma por uma antes de sair da página.

## O que vai mudar
- Quando houver uma página anterior dentro do sistema, o "Voltar" vai voltar de verdade para ela, sem abrir uma cópia nova.
- A página de origem só será usada quando não houver página anterior, por exemplo num link aberto direto ou numa página recarregada. Nesse caso, ela substitui a tela atual e não fica acumulada no histórico.
- Depois de salvar um RDO novo, o sistema volta para a página de onde a pessoa veio, como a Agenda, em vez de abrir uma cópia dela.
- Depois de salvar uma edição, o sistema volta para a página do RDO, que já aparece atualizada. A edição não fica no histórico.
- Trocar de aba entre RDOs do mesmo dia não vai mais encher o histórico.
- Abrir um RDO pela Agenda passa a registrar a Agenda como origem. Assim, o "Voltar" leva de volta à Agenda mesmo depois de recarregar a página.

## Como vou verificar
- Agenda → Novo RDO → Voltar → Voltar: sai da Agenda e não volta para a criação.
- Agenda → Novo RDO → Salvar → Voltar: sai da Agenda.
- Agenda → RDO → Editar → Salvar → Voltar de baixo: volta para a Agenda.
- Página do RDO → trocar de aba 3 vezes → Voltar: sai da página do RDO de uma vez.

## Detalhes técnicos
- `src/hooks/useSmartBack.ts`: ordem nova: `idx > 0` → `navigate(-1)`; senão `state.from` com `replace: true`; senão fallback com `replace: true`. Exportar também um helper `goBackOr(target)` para os fluxos pós-salvar.
- `src/pages/SimplifiedReportForm.tsx`: no `onSuccess` da criação (linhas ~562-567), usar `navigate(-1)` quando `idx > 0`; senão `originFrom`/`/reports?...` com replace. No `onSuccess` da edição (linha ~766), fazer o mesmo, com fallback para `/reports/:id` com replace.
- `src/pages/ReportForm.tsx` (linha ~741): trocar `navigate('/reports')` pelo mesmo helper.
- `src/components/reports/ReportDetailTabs.tsx` (linha ~97): `navigate(`/reports/${id}`, { replace: true, state: location.state })`, preservando a origem.
- `src/pages/ProjectCalendar.tsx` (linha ~978): passar `state: { from }` ao abrir `/reports/:id`.
