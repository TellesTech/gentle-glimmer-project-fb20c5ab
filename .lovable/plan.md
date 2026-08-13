# Histórico do RDO com nome e horário de quem assinou

Hoje o "Histórico do RDO" mostra apenas os eventos gravados na tabela de histórico (criado, editado, status alterado, enviado, aprovado). Quando o cliente assina, o evento aparece como "Status alterado / Aprovado" sem nome e sem identificar quem assinou — porque a assinatura é gravada em outra tabela (assinaturas do relatório), que a linha do tempo não consulta.

## O que será feito

- Buscar as assinaturas do RDO (nome do signatário, cargo/função, e-mail e data/hora da assinatura) junto com o histórico.
- Inserir cada assinatura como um evento próprio na linha do tempo: "Assinado por {Nome} ({Cargo})" com data e hora reais da assinatura, ordenado cronologicamente junto aos demais eventos.
- Distinguir visualmente assinatura do cliente e assinatura interna (WEES) no rótulo do evento.
- Quando o evento automático de "Status alterado (Enviado → Assinado)" e "Aprovado" ocorrer no mesmo instante de uma assinatura, atribuir o nome do signatário a esses eventos em vez de deixá-los sem autor.
- Aplicar em ambas as telas: portal do cliente e visão WEES do RDO.

## Detalhes técnicos

- `src/pages/ClientReportView.tsx` e `src/pages/ReportDetail.tsx`: na query de `report-history`, buscar também `report_signatures` (`signer_name`, `signer_role`, `signer_email`, `signed_at`, `signer_user_id`) do mesmo `report_id` e mesclar num único array de entradas passadas ao componente da linha do tempo.
- `src/components/reports/ApprovalTimeline.tsx`: aceitar entradas sintéticas de assinatura (action `signed` já existe no mapa de ícones/labels), exibindo `by = signer_name` e `details` com cargo/origem (Cliente ou WEES); usar o autor da assinatura como fallback de autor para eventos `status_changed`/`approved` sem `actor` ocorridos em janela de poucos segundos.
- Nenhuma alteração de banco de dados é necessária.
