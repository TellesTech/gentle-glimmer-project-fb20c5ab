# Plano de Sincronização de Nomes de Atividades (Base de Dados)

O objetivo é garantir que os nomes exibidos na busca da **Base de Dados** sejam idênticos aos exibidos nos cards de **Meus RDOs**, priorizando o número da OM e o título completo.

## Alterações propostas

### `src/pages/WorkforceDatabase.tsx`

1.  **Aprimorar a lógica de `displayName`**:
    *   Atualmente, usamos a primeira localização ou título de OM encontrado.
    *   Vou alterar para formatar como `OM [Número] — [Título/Localização]`, combinando os campos se ambos existirem, para espelhar exatamente a visualização dos cards de RDO.
2.  **Garantir consistência na indexação**:
    *   Garantir que tanto o `loadProjects` quanto o `loadRecords` usem essa mesma lógica de formatação.
3.  **Refinar a exibição no dropdown**:
    *   Exibir o nome formatado (OM + Título) como o nome principal do item no dropdown de projetos.

## Verificação
*   Abrir a **Base de Dados**.
*   Verificar se atividades como "OM 22461261 — Transportadora 09" aparecem com esse nome completo no dropdown.
*   Confirmar que a busca por "Transportadora" retorna o projeto correto.
