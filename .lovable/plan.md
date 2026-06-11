## Problema

Na visão de pastas dentro de uma empresa (ex.: CSN → CSN - Serra, CSN Pedro Leopoldo, …), as pastas mostram o `alt` text quebrado em vez de uma imagem. Isso acontece porque:

- O `FolderCard` da unidade só usa `siteFolder.photo_url`.
- As unidades não têm `photo_url` cadastrada, então o `<img>` é renderizado com `src` vazio/nulo e o navegador mostra o ícone de imagem quebrada com o alt.
- Não há fallback para a logo da empresa-mãe e o `<img>` é renderizado mesmo com `src` inválido.

## Solução

No `src/components/reports/DocumentCabinet.tsx`:

1. Adicionar `company_logo_url` ao tipo `SiteFolder` e preenchê-lo a partir de `company.logo_url` (ou `company.photo_url`) nos pontos onde os `SiteFolder` são construídos (linhas ~609 e ~631).
2. No `FolderCard` da unidade (linha ~1273):
   - Resolver a imagem como `siteFolder.photo_url || siteFolder.company_logo_url`.
   - Só renderizar o `<img>` se essa URL existir; senão mostrar o ícone `MapPin` (fallback atual).
   - Adicionar `onError` para esconder a imagem quando o link falhar (mesmo padrão já usado no card de empresa, linha ~1332).

Resultado: cada pasta de unidade mostra a logo da empresa quando não tiver foto própria, eliminando os alt-texts quebrados vistos no print.

## Escopo

- Apenas frontend, arquivo `src/components/reports/DocumentCabinet.tsx`.
- Sem mudanças em banco, queries ou outras telas.
