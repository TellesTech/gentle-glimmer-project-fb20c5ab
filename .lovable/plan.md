# Corrigir aviso "Relatório Assinado" quando ainda há assinaturas pendentes

## O que está acontecendo

No RDO aberto no portal, existem 3 assinaturas previstas e apenas 2 registradas (Walace Rocha e Dayvison Bissi). Lucas Rosa (cliente, Suzano) ainda está **Pendente**.

O bloco verde "Relatório Assinado / Sua assinatura foi registrada com sucesso!" aparece porque a tela só verifica se **quem está olhando** já assinou — não se o documento inteiro foi assinado. Como Dayvison assinou às 11:42, o painel de assinar some e entra o bloco verde, dando a impressão errada de que o RDO está concluído.

## O que será feito

Na tela do RDO do portal (`ClientReportView`):

1. Separar dois conceitos:
   - **Você já assinou** — quando o visitante atual já registrou a assinatura dele.
   - **RDO totalmente assinado** — quando não há mais nenhum signatário pendente.
2. Ajustar o bloco verde:
   - Se o visitante já assinou mas ainda faltam outros: card neutro/âmbar "Sua assinatura foi registrada — aguardando os demais signatários", com a contagem (ex.: "2 de 3 assinadas") e a lista de pendentes por nome.
   - Só exibir "Relatório Assinado" em verde quando todas as assinaturas estiverem concluídas.
3. Manter a linha do tempo de assinaturas como está (ela já mostra corretamente 2/3 e o status de cada um).

## Detalhes técnicos

- A contagem total/pendentes vem de `useReportSignaturesRealtime` (já usado pelo `SignatureTimeline`), que retorna `summary.total`, `summary.signed` e `summary.pending` — será reutilizado na página em vez de criar nova consulta.
- `canSign` continua com a mesma regra (não permitir assinar duas vezes); a mudança é apenas no bloco de estado exibido no lugar do formulário.
- Nenhuma alteração de banco de dados ou de edge function.
