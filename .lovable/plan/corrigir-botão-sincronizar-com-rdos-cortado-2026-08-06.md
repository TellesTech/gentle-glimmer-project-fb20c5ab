# Corrigir botão "Sincronizar com RDOs" cortado

O botão fica espremido na última coluna da grade de filtros e o texto ultrapassa a borda do cartão.

## O que será feito

- Tirar os botões "Importar Planilha" e "Sincronizar com RDOs" de dentro da grade de filtros.
- Colocá-los em uma linha própria logo abaixo dos filtros: alinhados à direita no desktop, largura total no celular.
- Garantir que o texto do botão não seja cortado.
- Encurtar o rótulo do filtro para "Atividade / Projeto", com a dica de busca (OM, título, fábrica, empresa) como texto auxiliar menor, liberando espaço na grade.

## Detalhes técnicos

- `src/pages/WorkforceDatabase.tsx`:
  - Grade de filtros passa de `lg:grid-cols-5` para `lg:grid-cols-4` (data início, data fim, fábrica, atividade).
  - Bloco dos dois botões movido para um `div` irmão: `flex flex-col sm:flex-row sm:justify-end gap-2`, com `w-full sm:w-auto` e `whitespace-nowrap` nos botões (removendo `flex-1`).