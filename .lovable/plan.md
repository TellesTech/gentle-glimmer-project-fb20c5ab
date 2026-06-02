Plano de correção:

1. Ajustar o `ImageUploader` para não tratar qualquer texto salvo em `photo_url` como imagem válida.
   - Hoje, se `image` tiver um valor quebrado/inválido, ele entra no modo de prévia e mostra apenas o ícone de imagem quebrada, escondendo a opção de upload.
   - Vou adicionar controle de erro no `<img>` para detectar falha de carregamento.

2. Quando a imagem estiver inválida, mostrar novamente a área normal de upload.
   - Exibir o campo com “Arraste uma imagem ou Selecionar arquivo”.
   - Manter o título “Foto da Fábrica”.
   - Não deixar o texto/URL quebrado ocupar o lugar do botão.

3. Melhorar o estado com foto existente válida.
   - Deixar a opção “Trocar” acessível de forma clara, sem depender apenas do hover se necessário.
   - Garantir que no formulário de Nova/Editar Fábrica sempre exista uma forma visível de enviar ou trocar a foto.

4. Validar no fluxo correto.
   - Conferir `/super-admin` → editar fábrica → seção “Foto da Fábrica”.
   - Confirmar que imagem quebrada cai no upload e imagem válida mantém prévia com opção de troca.