## Problema encontrado

O campo de upload está no lugar correto: `Editar/Nova Fábrica` em `/super-admin`, usando o bucket `company-photos`.

O erro real não é mais visual. O upload falha porque o bucket `company-photos` existe, mas não há política ativa em `storage.objects` permitindo inserir arquivos nesse bucket. Por isso aparece: `new row violates row-level security policy`.

## Plano de correção

1. **Adicionar políticas de Storage para `company-photos`**
   - Permitir leitura pública das fotos da fábrica, já que o bucket é público.
   - Permitir que usuários autenticados façam upload no bucket `company-photos`.
   - Permitir atualização e exclusão por usuários autenticados no mesmo bucket, mantendo o escopo limitado a fotos de fábrica.

2. **Manter o frontend atual**
   - O formulário já aponta para `bucketName="company-photos"` e `folder="companies"`.
   - O componente já mostra a área de upload quando a imagem antiga está quebrada.
   - Não é necessário mover o campo de lugar.

3. **Validar depois da migração**
   - Testar o fluxo em `/super-admin` → editar fábrica → selecionar arquivo.
   - Confirmar que o upload salva a URL em `photo_url` e a imagem aparece na listagem/cartão.

## Detalhes técnicos

Será criada uma migração SQL apenas para `storage.objects`, com políticas idempotentes usando `DROP POLICY IF EXISTS` antes de recriar as regras corretas para o bucket `company-photos`. Nenhuma tabela nova será criada.