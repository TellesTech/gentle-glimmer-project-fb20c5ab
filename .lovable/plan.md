# Super admin com acesso total aos RDOs

## O problema

A Laura é super admin, mas também está marcada como responsável por uma fábrica específica (Suzano Aracruz). Na tela de Relatórios, o arquivo de pastas trata "super admin com fábrica marcada" como acesso restrito: mostra apenas as empresas, fábricas, atividades e RDOs daquela fábrica (mais os RDOs criados por ela mesma). Por isso ela continua sem enxergar o restante.

Confirmado no código: a tela de Relatórios em si já ignora essa restrição para super admin, mas o arquivo de pastas ainda a aplica.

## O que vai mudar

- Super admin passa a ver tudo no arquivo de pastas: todas as empresas, todas as fábricas, todas as atividades e todos os RDOs, mesmo que tenha fábricas marcadas no cadastro.
- A restrição por fábrica continua valendo para administradores comuns, exatamente como hoje.
- Nada muda nas permissões de banco de dados nem em quem pode editar ou apagar.

## Detalhes técnicos

- `src/components/reports/DocumentCabinet.tsx`: `isRestrictedAdmin` passa a considerar apenas `role === 'admin'` (hoje inclui `super_admin`). Isso desativa, para super admin, os filtros em `adminProjectIds`, `all-companies-cabinet-v2`, `all-sites-cabinet-v2`, `reports-cabinet-all-v2` e `document-cabinet-projects`.
- Sem alterações de banco, RLS ou edge functions.
- Validar: entrar como Laura e conferir CSN → CSN Montes Claros → 2026 → Setembro → Atendimento à Parada, além das demais empresas.
- Publicar em https://rdo.wees.com.br após a validação.
