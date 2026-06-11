# Corrigir logos em branco nas pastas

## Causa encontrada
As fotos das unidades (CSN - Serra, Pedro Leopoldo, etc.) apontam para um projeto Supabase antigo (`knubzymetllizsgeoikh.supabase.co`) que não existe mais — as URLs estão mortas (14 unidades afetadas). O `onError` esconde a imagem quebrada, deixando o quadrado em branco. Como `photo_url` da unidade não é nulo, o fallback para a logo da empresa nunca é acionado.

A foto da empresa CSN está no projeto atual e funciona normalmente.

## Solução

1. **Migração no banco**: limpar (definir como NULL) o `photo_url` das unidades cujas URLs apontam para o domínio antigo `knubzymetllizsgeoikh.supabase.co` (14 registros).
2. Com isso, o fallback já implementado no `FolderCard` passará a exibir a logo/foto da empresa CSN automaticamente em todas as unidades.

## Detalhes técnicos
- SQL: `UPDATE sites SET photo_url = NULL WHERE photo_url LIKE '%knubzymetllizsgeoikh%';`
- Nenhuma mudança de código frontend necessária — o fallback já existe.
- As fotos originais das unidades foram perdidas na migração do projeto; se quiser fotos específicas por unidade, será preciso reenviá-las pelo app.