# Números do login: por que as 15 assinaturas não aparecem no portal

## Diagnóstico (confirmado no banco)

Na unidade Suzano Aracruz:

- As 15 assinaturas existem e estão todas concluídas, mas pertencem a RDOs de **janeiro/2026 (10) e fevereiro/2026 (5)** — exatamente os **dois meses que você ocultou** no portal. Por isso o cliente não vê nenhuma delas.
- A tela de login ainda mostra 194 relatórios / 15 assinaturas / 51 atividades porque a correção das funções de estatística **não chegou a ser aplicada** (a migração foi interrompida).
- Considerando apenas o que o cliente enxerga (sem rascunhos e sem meses ocultos), hoje existem **55 relatórios visíveis e 0 assinaturas visíveis**.

## O que será feito

1. Aplicar a correção das estatísticas de login:
   - Relatórios: apenas RDOs publicados (sem rascunhos) e fora dos meses ocultos.
   - Assinaturas: apenas assinaturas concluídas de RDOs visíveis (ficará 0 enquanto jan/fev estiverem ocultos).
   - Atividades: apenas atividades com pelo menos um RDO visível.
2. Remover o "+" do número de relatórios na tela de login (desktop e mobile), mostrando o valor exato.
3. Login abrindo direto no acesso por **e-mail e senha**; a opção de PIN só aparece quando existe contato com PIN já criado.

Se quiser que as 15 assinaturas voltem a contar e apareçam para o cliente, basta reexibir as pastas de janeiro e fevereiro/2026 no portal.

## Detalhes técnicos

- Migração: `get_site_login_stats` e `get_company_login_stats` passam a usar um CTE de relatórios visíveis (`status <> 'draft'` + `NOT EXISTS` em `portal_hidden_months` com mês base-0) e contam assinaturas com `signed_at IS NOT NULL` e atividades distintas desse conjunto.
- `src/pages/ClientLogin.tsx`: `mode` inicial `'email'` quando nenhum contato tem PIN; card "Acesso Rápido"/PIN condicionado a `contacts.some(c => c.has_pin)`; remoção do sufixo `+` nos dois blocos de estatísticas.
