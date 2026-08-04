# Corrigir clique nos cards de empresa em "Meus RDOs"

## O problema (confirmado no código e na URL atual)
Ao clicar num card de empresa nada abre — a URL fica só `?year=2026`, sem `company`.

Causa: no clique (DocumentCabinet.tsx, linhas 1849-1852) são feitas duas atualizações de URL em sequência:

```text
setOpenCompanyId(company.id)   -> grava company e apaga year
setOpenYear(selectedMainYear)  -> recebe a URL antiga (ainda sem company) e grava só year
```

A segunda chamada é processada com o estado anterior da URL, então o `company` recém-gravado é descartado. Resultado: o card parece "não clicar".

## Correção
Trocar as duas chamadas por uma única atualização de parâmetros que grava `company` e `year` juntos, limpando `site`, `month` e `project`. Sem mudança visual.

Também revisar os demais cliques de navegação (unidade, ano, mês, atividade) para garantir que nenhum outro ponto faça duas atualizações de URL encadeadas.

## Verificação
Clicar em uma empresa deve levar a `?company=<id>&year=<ano>` e abrir o nível de unidades; a navegação para trás continua funcionando.
