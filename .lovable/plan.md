# Calendário de RDOs em "Meus RDOs"

## Objetivo
Além das visões atuais (Armário/Pastas, Lista e Assinados), incluir uma visão **Calendário** em "Meus RDOs", mostrando os RDOs distribuídos nos dias do mês.

## O que será feito

1. **Novo botão de visão "Calendário"**
   - Na página "Meus RDOs", junto das opções existentes, um botão alterna para a visão de calendário.
   - A escolha permanece enquanto o usuário navega na página.

2. **Grade mensal**
   - Mês atual por padrão, com setas para avançar/voltar e botão "Hoje".
   - Cada dia mostra os RDOs daquela data: número do RDO, atividade e turno.
   - Dias com muitos RDOs mostram os primeiros e um "+N".

3. **Indicadores visuais de status** (mesmo padrão do calendário de atividade)
   - Ponto/cor por status: rascunho, concluído, enviado para assinatura, assinado.
   - Dias sem RDO ficam neutros; o dia de hoje é destacado.

4. **Interação**
   - Clicar em um RDO abre o detalhe do RDO.
   - Clicar em um dia vazio abre a criação de novo RDO já com a data preenchida.

5. **Respeita filtros e permissões**
   - O calendário usa os mesmos RDOs já carregados na página, portanto respeita filtro de atividade, busca, arquivados e a restrição de unidades do administrador.

## Detalhes técnicos
- Novo componente `src/components/reports/ReportsCalendar.tsx`, recebendo `reports` (já buscados em `Reports.tsx`) via props — sem consulta nova ao banco.
- Grade construída com `startOfMonth`/`endOfMonth`/`eachDayOfInterval` do date-fns, alinhando a semana com dias vazios no início, seguindo o padrão de `ProjectCalendar.tsx`.
- `Reports.tsx`: estender `viewMode` para `'list' | 'cabinet' | 'signed' | 'calendar'` e renderizar o novo componente nessa opção.
- Cores apenas por tokens semânticos do design system (sem cores fixas).
- Sem alteração de banco de dados.