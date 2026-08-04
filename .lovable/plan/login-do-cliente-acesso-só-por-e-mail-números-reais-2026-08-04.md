# Login do cliente: acesso só por e-mail + números reais

## 1. Acesso apenas por e-mail (PIN só depois de criado)

Hoje a tela de login abre em "Acesso Rápido" com a lista de nomes e o texto pedindo o PIN de 4 dígitos, mesmo quando ninguém tem PIN cadastrado.

Novo comportamento:
- A tela abre direto no formulário de **e-mail e senha** (o mesmo do link do convite `?mode=email`).
- O bloco de PIN e a lista de "Acesso Rápido" só aparecem quando existe pelo menos um contato daquela unidade com PIN já criado; caso contrário, nem o botão nem o texto de PIN são exibidos.
- Depois que o cliente criar o PIN no primeiro acesso, a opção "Entrar com PIN" passa a aparecer automaticamente para ele.
- O link "Prefere usar e-mail e senha?" deixa de existir (vira o padrão) e no lugar entra, quando aplicável, "Entrar com PIN".

## 2. Números da tela de login

Os números vêm do banco, mas contam coisas que o cliente não enxerga. Na unidade Suzano Aracruz hoje:

- Relatórios: 194 — inclui **71 rascunhos** e relatórios de meses que você ocultou no portal.
- Assinaturas: 15 — correto (15 assinadas).
- Atividades: 51 — conta todas as atividades, inclusive as sem RDO visível.

Correção:
- Relatórios: contar apenas os RDOs realmente publicados (excluir rascunhos) e excluir os meses ocultos do portal.
- Atividades: contar apenas atividades que possuem ao menos um RDO visível.
- Assinaturas: manter apenas as efetivamente assinadas.
- Remover o "+" depois do número de relatórios, para mostrar o valor exato.

## Detalhes técnicos

- Migração: atualizar `get_site_login_stats` e `get_company_login_stats` para filtrar `reports.status <> 'draft'`, excluir períodos presentes em `portal_hidden_months` (por site/mês/ano) e contar atividades distintas com RDO visível; assinaturas com `signed_at is not null`.
- `src/pages/ClientLogin.tsx`: default `mode = 'email'` quando não há contatos com PIN; exibir o card de seleção/PIN apenas se `contacts.some(c => c.has_pin)`; ajustar rodapé de botões; remover o sufixo `+` nos dois blocos de estatística (desktop e mobile).
