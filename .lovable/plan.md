# Renomear pastas e editar RDO no portal do cliente (sincronizado com a área WEES)

Hoje o nome da pasta de atividade é sempre calculado a partir dos dados dos RDOs (`OM <número> — <título>`), sem possibilidade de renomear. E no portal do cliente o RDO é somente leitura.

## O que será feito

### 1. Renomear pasta de atividade
- Botão de renomear (ícone de lápis) em cada pasta de atividade:
  - Portal do cliente (grade de atividades do mês)
  - Área WEES ("Meus RDOs" / armário de documentos)
- O nome personalizado é salvo uma única vez e vale para os dois lados: renomeou no portal, muda na WEES, e vice-versa.
- Opção "Restaurar nome automático" volta ao nome calculado pela OM.
- Disponível para usuários do portal do cliente e para a equipe WEES.

### 2. Edição rápida do RDO na página de assinatura
- Na página do RDO dentro do portal, botão **"Editar"** abre um painel com os campos:
  - Data
  - Local
  - Número da OM e título da OM
  - Observações/comentários
- Ao salvar, os dados são gravados no próprio RDO — portanto aparecem imediatamente na área WEES (lista, cards, calendário, PDF) e vice-versa: o que a WEES editar aparece no portal.
- RDO já assinado também pode ser editado; toda alteração fica registrada no histórico do RDO (quem alterou, quando e o que mudou).
- Como o nome da pasta vem da OM, alterar o número/título da OM reorganiza a pasta automaticamente — o aviso disso aparece na hora de salvar.

## Detalhes técnicos

### Banco
- Nova tabela `public.rdo_activity_names`: `site_id`, `group_key` (chave do grupo: `om:<numero>` / `title:<titulo normalizado>` / `project:<id>`), `custom_name`, `created_by`, timestamps, com índice único em (`site_id`, `group_key`).
  - GRANTs para `authenticated` e `service_role`; RLS: leitura e escrita para quem tem acesso à unidade (`user_has_site_access`) ou acesso pelo portal (`portal_user_site_ids`).
- Política de UPDATE em `public.reports` para usuários do portal, restrita às unidades a que têm acesso (`portal_user_site_ids`), permitindo apenas alterar os campos de edição rápida. O trigger `log_report_changes` já registra o histórico; será ampliado para incluir `date` e os campos de OM.

### Frontend
- `src/lib/rdoActivityGroups.ts`: `buildActivityGroups` passa a aceitar um mapa opcional de nomes personalizados e aplica o override no `name` (mantendo `searchString` com o nome original + o novo).
- Novo hook `src/hooks/useActivityNames.ts`: lê e grava os nomes personalizados por unidade (React Query, com invalidação nos dois contextos).
- `src/pages/client/ClientDashboard.tsx` e `src/components/reports/DocumentCabinet.tsx`: botão de renomear + diálogo, usando o mesmo hook e a mesma chave de grupo (o armário passa a usar a chave do `buildActivityGroups`, alinhando com o portal).
- `src/pages/ClientReportView.tsx`: botão "Editar" e diálogo de edição rápida com validação (zod), salvando em `reports` e invalidando as consultas do portal e da área WEES.

## Verificação
1. Renomear uma pasta no portal e conferir o novo nome em "Meus RDOs" (e o inverso).
2. Editar data/local/OM/observações de um RDO assinado pelo portal e conferir na área WEES e no histórico do RDO.
3. Confirmar que "Restaurar nome automático" volta ao padrão `OM <número> — <título>`.