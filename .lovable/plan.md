## Problema

Todas as fotos do RDO retornam "Erro ao carregar". As URLs guardadas em `report_photos.url` apontam para um Supabase **diferente** (`knubzymetllizsgeoikh`), provavelmente o projeto antigo de origem dos dados. O bucket `report-photos` não existe neste projeto.

O hook `useStorageUpload.getViewUrl` vê o substring "supabase" na URL e tenta re-assinar contra o bucket `report-photos` **do projeto atual**, que não tem o arquivo — todas as chamadas para `/storage/v1/object/sign/report-photos/...` voltam 404, e a galeria mostra o ícone de erro.

Mas as URLs salvas já são **públicas** (`/storage/v1/object/public/report-photos/...`). Não precisam ser assinadas: basta usá-las direto no `<img src>` para que o navegador as carregue do projeto antigo, que mantém o bucket público.

## Correção (apenas frontend)

Em `src/hooks/useStorageUpload.ts`, dentro de `getViewUrl`:

- Se `storedUrl` for um link `http(s)` que contenha `/storage/v1/object/public/`, retornar a URL como está. Não tentar assinar.
- Mantém o comportamento atual para:
  - Caminhos relativos (sem `http`) → assinar no bucket atual
  - URLs `/storage/v1/object/sign/...` ou outras URLs Supabase não públicas → continuar tentando extrair path e re-assinar

Mesma checagem em `src/components/reports/PhotoGallery.tsx` no cálculo `needsSignedUrl` para evitar entrar no fluxo desnecessariamente: tratar URLs `/object/public/` como já-prontas.

## Validação

Após o ajuste, recarregar `/reports/7b8acda6-...`:
- As 7 fotos devem aparecer na grade
- O lightbox abre normalmente
- Sem chamadas 400/404 a `/storage/v1/object/sign/report-photos/...` na aba Network

## Observação para o usuário

Os arquivos permanecem hospedados no projeto Supabase antigo (`knubzymetllizsgeoikh`). Se aquele projeto for desligado ou o bucket virar privado, as fotos antigas vão sumir. Quando quiser, posso preparar uma migração de mídia (baixar do projeto antigo e subir para um bucket `report-photos` neste projeto, atualizando `report_photos.url`) — não está incluso nesta correção.