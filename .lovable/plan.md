Plano para corrigir o upload da fábrica:

1. Ajustar `src/components/shared/ImageUploader.tsx` para não renderizar uma `<label>` vazia quando `label=""`.
   - Hoje essa label vazia ocupa a área logo abaixo de “Foto da Fábrica”, dando a impressão de que o upload sumiu.
   - A correção será renderizar a label interna apenas quando houver texto.

2. Ajustar o uso em `src/components/companies/CompanyFormDialog.tsx` para garantir espaço visível do upload.
   - Manter “Foto da Fábrica” no topo.
   - Usar o `ImageUploader` com `label="Foto da Fábrica"` ou remover a label externa para evitar duplicidade.
   - Garantir que a área “Selecionar arquivo” apareça quando não houver imagem e que “Trocar/Editar/Deletar” apareça quando houver imagem.

3. Validar visualmente no `/super-admin`.
   - Abrir edição/criação de fábrica.
   - Confirmar que a seção mostra o campo completo de upload logo abaixo do título “Foto da Fábrica”.