Diagnóstico encontrado:
- O app continua enviando fotos para o bucket `report-photos`.
- O Supabase conectado não tem esse bucket; os buckets existentes são `avatars`, `company-photos`, `service-report-photos` e `temp-backups`.
- A requisição que falha é `POST /storage/v1/object/report-photos/...`, com resposta `Bucket not found`.
- A tentativa anterior provavelmente não criou o bucket de verdade, porque buckets de Storage não devem ser criados via SQL/migration; precisam ser criados pela Storage API.

Plano de correção:
1. Criar o bucket real `report-photos` no Supabase Storage usando a ferramenta nativa de Storage, público para manter as URLs atuais usadas no PDF/portal.
2. Adicionar políticas em `storage.objects` para o bucket `report-photos`:
   - qualquer pessoa pode visualizar as imagens públicas;
   - usuários autenticados podem enviar, editar e remover fotos do RDO.
3. Reconsultar os buckets e políticas para confirmar que `report-photos` aparece na lista e que as regras foram aplicadas.
4. Se a criação do bucket público for bloqueada pela configuração do workspace, ajustar o plano para usar um bucket já existente (`service-report-photos`) e trocar o frontend do RDO para apontar para ele.

Arquivos previstos:
- Sem alteração inicial de frontend se o bucket puder ser criado corretamente.
- Alteração em `src/hooks/useStorageUpload.ts`, `src/components/shared/PhotoUploader.tsx` e usos relacionados somente se for necessário migrar para um bucket existente.