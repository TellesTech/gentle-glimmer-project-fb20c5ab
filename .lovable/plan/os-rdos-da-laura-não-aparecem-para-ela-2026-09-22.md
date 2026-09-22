# Os RDOs da Laura não aparecem para ela

## O que foi verificado

- Os RDOs existem: 10 relatórios criados pela conta da Laura (Laura Spinasse Morellato), sendo 6 da CSN – Montes Claros (RDO 1, 2, 4, 5, 6 e 8, de 14 a 17/09) e 4 da Aperam Timóteo. Nenhum está arquivado nem oculto do portal.
- O acesso dela está correto: é Super Admin, entrou hoje às 10:46 (horário de São Paulo), e as regras de leitura do banco liberam todos os RDOs para esse perfil.
- Na pasta "Atendimento à Parada – 14.09 a 05.10" há 9 RDOs no total (os 6 dela + 3 criados pelo WhatsApp), todos no mesmo card de atividade.
- O registro de erros do sistema mostra hoje, às 9:32, dezenas de quebras na tela de Relatórios com a mensagem "downloadingReportId is not defined". Quando isso acontece, a tela trava e a lista de RDOs simplesmente não é desenhada — exatamente o sintoma relatado.

Ou seja: nada foi perdido. A tela de RDOs estava quebrando ao carregar, por causa do botão de download acrescentado nos cards.

## O que será feito

1. **Tornar o botão de download à prova de falha**: o botão dos cards passa a usar o estado de carregamento de forma segura, sem depender de uma variável que pode não existir no momento em que o card é desenhado. Isso elimina a quebra da tela mesmo em versões antigas em cache.
2. **Proteger a tela inteira**: envolver a área de Relatórios com a proteção contra erros já existente no sistema, para que uma falha pontual mostre um aviso com botão de recarregar em vez de deixar a tela em branco.
3. **Publicar** no endereço do dia a dia (rdo.wees.com.br) e pedir à Laura que atualize a página com Ctrl+F5, já que o navegador dela pode estar com a versão antiga guardada.

## Verificação

- Abrir a tela de Relatórios, entrar em CSN – Montes Claros → setembro/2026 e conferir que os 9 RDOs aparecem, com o botão de download funcionando.
- Conferir que nenhum novo erro "downloadingReportId" é registrado após a publicação.

## Detalhes técnicos

- `src/components/reports/DocumentCabinet.tsx`: extrair `CardActions` do corpo do componente (hoje é redefinido a cada render e captura `downloadingReportId` por closure) para um componente estável que recebe `downloadingId` e `onDownload` por props; garantir que `downloadSingleReport` também seja passado por prop.
- `src/pages/Reports.tsx`: envolver o conteúdo em `ErrorBoundary` (`src/components/shared/ErrorBoundary.tsx`).
- Sem mudanças no banco: dados, RLS e `created_by` estão corretos.
