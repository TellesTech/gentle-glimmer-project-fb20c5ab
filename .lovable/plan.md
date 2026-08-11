# Corrigir erro "Não foi possível registrar o acesso da assinatura"

## Causa confirmada
- A mensagem vem de `ensureAccessRecord` em `supabase/functions/_shared/signature-auth.ts` (linha 189), quando falha o insert em `client_report_access`.
- A tabela `client_report_access` tem chave estrangeira `created_by → profiles(id)`.
- A função grava `created_by = signer.userId`. Para clientes do portal, esse ID é o usuário de autenticação e **não existe em `profiles`** (verificado: Lucas Rosa, `user_id aafb434e-...`, sem perfil correspondente).
- Resultado: violação de chave estrangeira, insert rejeitado e a assinatura falha antes de ser gravada — o mesmo acontece na assinatura em lote, que usa a mesma função.

## Correção
1. Em `signature-auth.ts`, só preencher `created_by` quando o signatário for interno (WEES). Para cliente, contato e convidado, gravar `created_by` nulo (a coluna já aceita nulo), mantendo nome e e-mail do signatário.
2. Tratar corridas de concorrência: se o insert falhar, tentar reencontrar um registro existente para o mesmo relatório/e-mail antes de retornar erro.
3. Propagar a mensagem real do banco no log e devolver ao frontend um texto específico em vez do genérico, para diagnósticos futuros.

## Verificação
- Assinar um RDO como cliente do portal (Suzano) e confirmar a linha em `report_signatures` e em `client_report_access`.
- Repetir com um usuário WEES para garantir que `created_by` continua preenchido.
- Testar assinatura em lote e assinatura por link de convidado.

## Detalhes técnicos
Arquivo alterado: `supabase/functions/_shared/signature-auth.ts` (apenas a função `ensureAccessRecord`). Nenhuma migração de banco é necessária.
