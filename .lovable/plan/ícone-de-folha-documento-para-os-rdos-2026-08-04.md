# Ícone de folha (documento) para os RDOs

Na lista de RDOs de uma atividade, cada item é desenhado como uma pasta amarela. RDO é documento, não pasta: será substituído por um ícone de folha/página.

## O que será feito

Em `src/pages/client/ClientActivityList.tsx`, trocar o desenho da pasta por uma folha de papel em retrato:

- Página branca com borda sutil, sombra e canto superior direito dobrado (efeito "dog-ear")
- Faixa colorida no topo indicando o status (verde assinado, âmbar aguardando, vermelho pendente)
- No centro da folha: "RDO" acima e o número (#002) em destaque
- Algumas linhas cinza finas abaixo, simulando o texto do documento
- Mantido o selo de status no canto (check verde / relógio) e o hover com leve elevação
- Legenda abaixo com "RDO #00X" e a data, como já existe

Pastas continuam representando mês e atividade; apenas o nível RDO passa a ser folha.
