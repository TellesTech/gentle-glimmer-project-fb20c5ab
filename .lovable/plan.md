## Objetivo
Recuperar os dados detalhados de presença (`report_attendance`) e/ou base manual (`workforce_database`) a partir do projeto Supabase antigo (provavelmente `knubzymetllizsgeoikh`) para que a aba **Dashboard / Detalhado** da Base de Dados HH volte a exibir informações.

## Situação atual
- Projeto novo (`jujzmxbexukxljljpefu`): 918 RDOs em `reports`, mas `report_attendance` e `workforce_database` estão **vazios**.
- Bucket `temp-backups` vazio; nenhuma tabela `backup_history` no projeto novo.
- O código da página já está correto — só não há dado para puxar.

## O que vou precisar de você
Para acessar o projeto antigo, preciso de dois segredos (vou cadastrá-los via tool de secrets quando entrarmos em build mode):

1. `OLD_SUPABASE_URL` — ex.: `https://knubzymetllizsgeoikh.supabase.co`
2. `OLD_SUPABASE_SERVICE_ROLE_KEY` — service role key do projeto antigo (Settings → API → service_role)

Sem esses dois segredos não consigo ler nada do projeto antigo.

## Plano de execução

### 1. Edge function `migrate-workforce-from-old`
Criar uma function (acesso restrito a `super_admin`) que:
- Conecta no projeto antigo usando os secrets acima.
- Lê em páginas de 1000 as tabelas `report_attendance`, `workforce_database` e (opcional) `workforce_delays` do projeto antigo, filtradas por intervalo de datas opcional.
- Para `report_attendance`, faz match dos `report_id` antigos com os `reports.id` atuais via chave natural (`project_id` + `date` + `shift` + `rdo_number`). RDOs sem correspondência ficam num relatório de "não migrado" devolvido ao final.
- Faz `upsert` no projeto atual em batches, com `on conflict` numa chave estável (id, ou par worker+report).
- Retorna contadores: `attendance_migrated`, `attendance_skipped`, `workforce_db_migrated`, `delays_migrated`, lista de RDOs sem match.

### 2. UI mínima de disparo
Em `WorkforceDatabase.tsx`, adicionar (somente para `super_admin`) um botão "Migrar do Supabase antigo" que:
- Abre dialog para escolher intervalo de datas (default: todo o histórico).
- Chama a edge function e mostra os contadores devolvidos + lista de RDOs não-mapeados.

### 3. Validação
- Conferir via `read_query` que `report_attendance` e `workforce_database` ganharam linhas.
- Recarregar a página `/workforce-database` em maio/2026 e confirmar que Dashboard e Detalhado mostram dados.

## Observações
- Se o projeto antigo não tiver `report_attendance` populado também, a migração não vai resolver — nesse caso voltamos para a alternativa de "Importar via Excel".
- Se você não tiver a service_role do projeto antigo mas tiver acesso ao dashboard, pode exportar as três tabelas em CSV/JSON e me enviar — aí adapto a function para receber upload em vez de conectar no Supabase antigo. Me avisa qual caminho prefere.
