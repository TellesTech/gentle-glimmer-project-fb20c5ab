# Coluna ATIVIDADE na planilha da Base de Dados

## Diagnóstico
- A exportação da Base de Dados (`src/pages/WorkforceDatabase.tsx`, `exportExcel`) já inclui a coluna **ATIVIDADE** na primeira aba, preenchida com o rótulo da atividade (mesmo nome dos cards "Meus RDOs", via `activityNameForProject` / `rdoActivityGroups`), além da aba "Atrasos no Período" com coluna ATIVIDADE / PROJETO.
- O PDF exportado também já tem a coluna ATIVIDADE.
- O usuário exporta pelo **site publicado** (rdo.wees.com.br) e lá a coluna **não aparece** — ou seja, o site publicado está com uma versão antiga, anterior a essa correção.

## O que fazer
1. **Verificar no preview** que a planilha exportada da Base de Dados já sai com a coluna ATIVIDADE preenchida (teste rápido com dados reais).
2. **Republicar o site** para que a versão atual (com a coluna ATIVIDADE no Excel e no PDF) vá ao ar no endereço publicado.
3. Confirmar com o usuário uma nova exportação pelo site publicado após a republicação.

## Detalhes técnicos
- Nenhuma mudança de código prevista: a correção já existe em `WorkforceDatabase.tsx` (`exportExcel`, linhas ~856-929, e `exportPdf`).
- Se o teste no preview revelar linhas sem atividade, tratar o fallback (`activity_name` nulo → nome do projeto → 'Sem projeto') na mesma alteração.
- Republicar via ferramenta de publicação, sem alterar slug nem domínio.
