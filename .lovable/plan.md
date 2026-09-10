# Cada pessoa do cliente vê apenas os RDOs que ela precisa assinar

Hoje qualquer contato ativo de uma unidade vê todos os RDOs enviados daquela unidade, e o envio já vem com todos os contatos marcados. Vamos passar para um modelo por pessoa: quem não foi escolhido não vê o RDO.

## 1. Envio para assinatura (área WEES)

- A lista de contatos da unidade passa a vir **sem ninguém marcado**.
- O botão de enviar fica bloqueado até escolher pelo menos uma pessoa.
- Aviso atual "será enviado automaticamente para todos os contatos" é substituído por "somente as pessoas marcadas verão e poderão assinar este RDO".
- Atalhos "Marcar todos" / "Limpar" para facilitar quando for mesmo para todos.

## 2. Portal do cliente: visão restrita

Em todas as telas do portal (início, pastas de atividade, lista de RDOs, relatórios assinados e link direto para um RDO), a pessoa passa a ver **apenas** os RDOs em que ela foi indicada como signatária. RDOs da mesma unidade em que ela não foi indicada não aparecem em lugar nenhum — nem em contagens, nem em downloads em lote.

Pastas de atividade e de mês que ficarem sem nenhum RDO visível simplesmente não aparecem para aquela pessoa.

Também deixa de existir a liberação automática: hoje, ao abrir um RDO, o sistema cadastra a pessoa como signatária sozinho. Isso será removido.

## 3. Gestão pelo admin WEES dentro da área do cliente

Nas telas da área do cliente (visualizadas por admin/super admin da WEES), ao lado dos controles atuais de ocultar/remover:

- **Em cada pasta de atividade e em cada pasta de mês:** ação "Definir signatários" — abre a lista de contatos da unidade e aplica a escolha a todos os RDOs daquela pasta de uma vez (adiciona quem foi marcado, remove quem foi desmarcado, preservando quem já assinou).
- **Em cada RDO:** mesma ação, aplicada só àquele documento.
- Cada linha da lista mostra quantos RDOs a pessoa já assinou naquela pasta, para não remover alguém por engano.

## 4. Histórico já enviado

Nada é apagado automaticamente. O ajuste do que cada pessoa vê no histórico passa a ser feito pelo admin da WEES com a ação "Definir signatários" por pasta, descrita acima.

## Detalhes técnicos

- `SendForSignatureDialog.tsx`: remover o auto-select de todos os contatos; validar seleção mínima; textos atualizados.
- Visibilidade: `ClientDashboard.tsx` passa a montar a lista a partir das linhas de `report_company_approvers` / `report_client_approvers` do usuário (hoje ela usa `portal_user_site_ids` + todos os projetos). `ClientActivityList.tsx`, `ClientReports.tsx` e `ClientReportView.tsx` filtram pelos mesmos IDs; a edge function `get-client-report` valida a existência da linha de aprovador antes de devolver o RDO.
- Banco: `can_view_portal_report(_user_id, _report_id)` passa a exigir linha de aprovador para o usuário (mantendo as regras atuais de mês/RDO oculto e de super admin/admin WEES).
- `supabase/functions/_shared/signature-auth.ts`: remover o `ensureContactApprover` que cria a linha de aprovador sozinho; sem linha prévia → 403.
- Novo componente `SignersManagerDialog.tsx` + hook `useReportSigners` para ler/gravar aprovadores em lote (upsert dos marcados, delete dos desmarcados com `status <> 'approved'`), usado nos menus de pasta/mês/RDO das telas do portal, restrito a `role in ('admin','super_admin')`.
- Invalidação de cache de `client-dashboard-reports`, `client-activity-reports`, `client-signed-reports` e `portal-responsibles` após cada alteração.
