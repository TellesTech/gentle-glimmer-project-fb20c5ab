# Validar salvamento de fotos nos RDOs (teste ponta a ponta)

## Objetivo
Confirmar, sem depender de teste manual, que adicionar e salvar fotos funciona — inclusive em RDOs criados pela IA/WhatsApp (onde `created_by` fica vazio).

## O que já foi verificado no banco
- Política `Users with report access can manage photos` (ALL) ativa em `report_photos`, com USING e WITH CHECK equivalentes.
- Permissões de acesso à API de dados corretas (`authenticated`, `service_role`).
- Gravações recentes existem: 95 fotos nas últimas 48h, a última hoje às 12:42 (horário de São Paulo).

## Teste que será executado
1. Abrir o preview autenticado e localizar um RDO criado pela IA/WhatsApp (sem autor definido).
2. Abrir a edição desse RDO, anexar uma imagem de teste e salvar.
3. Conferir na tela que a foto permanece após recarregar a página.
4. Conferir no banco que a linha correspondente entrou em `report_photos` e que a imagem existe no bucket de armazenamento.
5. Repetir a edição removendo a foto de teste, para validar a sincronização incremental (remove só o que saiu, mantém o resto).
6. Limpar o registro de teste ao final.

## Resultado esperado
Relato objetivo: funcionou ou não, com a mensagem de erro exata e a causa caso falhe. Se falhar, aponto o ponto exato (upload no bucket, insert na tabela ou política de acesso) e proponho a correção em seguida.

## Detalhes técnicos
- Automação via Playwright contra `http://localhost:8080`, com sessão restaurada a partir da sessão de preview.
- Verificação de dados por consultas de leitura em `report_photos` e checagem do objeto no bucket `service-report-photos`.
- Nenhuma alteração de código nesta etapa; apenas diagnóstico. Correções, se necessárias, entram em um passo seguinte.
