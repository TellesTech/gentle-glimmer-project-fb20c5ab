# Corrigir erro ao abrir "Meus RDOs" + RDOs visíveis automaticamente

## 1. Erro ao acessar os RDOs (corrigir primeiro)
A tela quebra com "Rendered more hooks than during the previous render", vindo de `src/components/reports/DocumentCabinet.tsx`.

Causa confirmada: os hooks `useMemo` de `availableYears` (linha 1789) e `filteredCompanyFolders` (linha 1801) estão declarados **depois** dos `return` antecipados dos níveis de navegação (empresa/unidade/ano/mês). Ao entrar ou sair de uma pasta, o componente renderiza uma quantidade diferente de hooks e o React derruba a tela.

Correção: mover esses dois `useMemo` (e o cálculo de `currentYear`/`selectedMainYear` que eles usam) para antes de qualquer `return` antecipado, junto dos demais hooks no topo do componente. Nenhuma mudança de comportamento ou layout.

## 2. RDOs da WEES aparecem automaticamente para o cliente

## O problema (confirmado nos dados)
Hoje o portal só mostra um RDO para o cliente quando alguém da WEES **convida aquele contato como aprovador** daquele relatório específico. Sem esse convite, o RDO não aparece — mesmo estando assinado.

Consulta feita agora no banco:

```text
Site                    RDOs assinados   RDOs com aprovador vinculado
Suzano Aracruz                 7                     0
Portocel Aracruz               4                     0
ArcelorMittal Pecém            2                    14
Juiz de Fora                   1                     0
```

Ou seja: em Suzano, Portocel e Juiz de Fora o cliente entra no portal e não vê nenhum RDO, embora existam relatórios assinados.

## O que vai mudar
A visibilidade passa a ser **automática por unidade (site)**:

- Todo RDO assinado (assinado/finalizado) de uma unidade aparece para os contatos/clientes vinculados àquela unidade, sem depender de convite.
- **A ocultação manda:** o que o colaborador/super admin da WEES ocultar (pasta de mês em `portal_hidden_months`) continua invisível para o cliente — some da lista, das pastas, das métricas e do download em lote. Tudo o que não foi ocultado aparece automaticamente.
- Rascunhos e RDOs não assinados continuam fora do portal.
- O botão **Aprovar/Assinar** continua restrito: só aparece para quem foi realmente designado como aprovador daquele RDO. Os demais têm acesso de leitura e download.
- Métricas, pastas de mês, lista de atividades e download em lote passam a refletir essa lista automática.

## Detalhes técnicos

**Banco (migração)**
- Nova função `public.get_portal_visible_report_ids(_user_id uuid)` (SECURITY DEFINER): retorna os RDOs assinados/finalizados das unidades ligadas ao usuário via `contact_sites`, `client_sites` e `company_contacts.company_id` / `client_profiles.company_id`, excluindo meses em `portal_hidden_months`.
- Política de leitura em `reports` para contatos/clientes de portal usando essa função (hoje `company_contacts` não tem nenhuma política de leitura em `reports`; clientes só leem via `report_client_approvers`).
- Políticas de leitura equivalentes em `report_photos`, `report_activities`, `report_signatures` e demais tabelas filhas usadas pela página do RDO, para que a abertura do relatório não quebre.

**Frontend**
- `src/pages/client/ClientDashboard.tsx`: a query `clientReportsData` deixa de partir das linhas de aprovador e passa a buscar os RDOs assinados das unidades do usuário; as linhas de aprovador viram apenas mapa auxiliar para definir `canSign` / `approverRowId`.
- `src/pages/client/ClientActivityList.tsx`: mesma mudança de escopo na resolução de `reportIds`.
- `src/pages/ClientReportView.tsx`: garantir que a abertura por id funcione para usuário sem linha de aprovador (leitura + PDF liberados, assinatura só para designados).

## Verificação
Após a migração, conferir que um contato de Suzano Aracruz enxerga os 7 RDOs assinados e que o botão de assinar não aparece para quem não foi designado.