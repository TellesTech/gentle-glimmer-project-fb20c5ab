# Botão "Voltar" sempre retorna à página anterior

## Objetivo
Ao criar um RDO (ex.: a partir da Agenda da atividade), o "Voltar" deve levar de volta à Agenda, e não ao início. O mesmo comportamento vale para todos os botões de voltar do sistema.

## Mudanças
1. Criar um recurso único de "voltar inteligente" que:
   - volta exatamente para a página de onde a pessoa veio (incluindo filtros, mês e aba abertos);
   - quando não houver página anterior no app (link aberto direto, página recarregada, nova aba), vai para a página "pai" lógica (ex.: criação de RDO → Agenda da atividade; detalhe do RDO → Meus RDOs), nunca para o início.
2. Registrar a origem ao abrir telas de criação/edição: Agenda, pastas de atividade, detalhe do RDO, painéis de fábrica/unidade e o assistente de novo RDO passam a informar "de onde vim".
3. Após salvar um RDO novo, voltar também para a página de origem (ex.: Agenda) em vez de uma tela fixa.
4. Aplicar o mesmo recurso em todos os botões de voltar: criação/edição de RDO (simples e completo), detalhe do RDO, Agenda, painéis de empresa e unidade, editor de relatório de serviço, assinaturas, exportações, seleção de portal e telas do portal do cliente.

## Verificação
- Agenda → Novo RDO → Voltar: retorna à Agenda no mesmo mês.
- Pasta de atividade → Novo relatório → Voltar: retorna à pasta.
- Abrir a criação por link direto → Voltar: vai para a Agenda da atividade.

## Detalhes técnicos
- Novo hook `src/hooks/useSmartBack.ts`: usa `location.state.from` quando presente; senão `navigate(-1)` se `window.history.state?.idx > 0`; senão rota de fallback passada por parâmetro.
- Chamadas de `navigate('/reports/create/...')`, `/reports/new` e edição passam `state: { from: location.pathname + location.search }`; o wizard repassa o `from` ao seguir para `/reports/create`.
- Substituir `navigate(-1)` / `navigate('/home')` / `navigate('/reports')` usados como voltar em `SimplifiedReportForm`, `ReportForm`, `ReportDetail`, `ProjectCalendar`, `CompanyDashboard`, `SiteDashboard`, `ServiceReportEditor`, `AdminSignatures`, `AdminExports`, `ClientPortalPicker`, `ProjectSelector`, `ClientLayout`, `ClientReportView`.
- Fallback da criação: `/projects/:projectId` (com `month` da data do RDO).
