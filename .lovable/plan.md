# Assinatura do cliente não aparece como assinada na WEES

## O que aconteceu (confirmado no banco)

O cliente da Suzano (Lucas Rosa, lucasrosa.timenow@suzano.com.br) assinou de fato: existem assinaturas gravadas em `report_signatures` em 12/08, com desenho da assinatura, e-mail e usuário corretos (RDOs 16, 17, 18, 19, 21, entre outros).

O problema é que a assinatura foi gravada **apenas** na tabela de assinaturas. O registro do aprovador continua "pendente":

- `report_company_approvers` do Lucas nesses RDOs: `status = pending`, `approved_at = null`
- `reports.status` continua `sent` (não virou `signed`)

A tela que a WEES usa (Assinaturas / painel administrativo) lê o status a partir de `report_company_approvers`, então tudo aparece como pendente mesmo com a assinatura registrada.

Total de assinaturas de cliente hoje nessa situação: **15**.

## Causa

As funções `submit-signature` e `submit-bulk-signatures` inserem a linha em `report_signatures`, mas nunca atualizam o aprovador correspondente nem o status do relatório.

## Correção

1. **Fechar o ciclo ao assinar** (`submit-signature` e `submit-bulk-signatures`):
   - após gravar a assinatura, marcar o aprovador correspondente do signatário como `approved` com `approved_at`/`signed_at` (em `report_company_approvers` para contatos da empresa cliente e `report_client_approvers` para perfis de cliente);
   - quando todos os aprovadores do RDO estiverem aprovados, mudar `reports.status` para `signed` e preencher `approved_at`;
   - falha nessa etapa não invalida a assinatura: registra log e retorna sucesso, mas o caso normal passa a atualizar tudo.

2. **Regularizar o histórico (backfill)**
   - migração que, para toda assinatura já existente com e-mail correspondente a um aprovador pendente, marca o aprovador como aprovado usando a data real da assinatura, e ajusta `reports.status` para `signed` nos RDOs cujos aprovadores ficarem todos aprovados. Isso corrige imediatamente os 15 casos, incluindo os RDOs da Suzano.

3. **Tornar a leitura à prova de falha na área WEES**
   - `AdminSignatures.tsx` passa a considerar também a existência de assinatura em `report_signatures` ao exibir o status, para que uma assinatura registrada nunca mais apareça como pendente mesmo se o aprovador ficar dessincronizado.

## Verificação

- Conferir no banco que os aprovadores dos RDOs 16–21 da Suzano ficam `approved` com a data de 12/08 e os RDOs viram `signed`.
- Abrir a página de Assinaturas como WEES e confirmar que esses RDOs aparecem em "Assinados".
- Confirmar que o portal do cliente continua mostrando os mesmos RDOs em verde.
- Sem mudança de RLS, permissões ou fluxo de login.
