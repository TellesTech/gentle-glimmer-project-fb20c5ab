# Corrigir fotos que não salvam nos RDOs

## O que foi verificado

- O upload para o storage funciona: o bucket `service-report-photos` é público e qualquer usuário autenticado pode enviar arquivos.
- O problema está na gravação do vínculo foto ↔ RDO (tabela `report_photos`):
  - A regra de acesso atual só permite gravar fotos se o usuário for **o criador do RDO** ou tiver papel admin/diretor/supervisor/líder/super admin.
  - RDOs criados pela IA do WhatsApp ficam **sem criador** (`created_by` vazio). Confirmado no banco: os RDOs mais recentes têm criador nulo. Quando alguém edita esses RDOs e adiciona fotos, a gravação é bloqueada.
  - Nenhum dos formulários verifica erro ao inserir fotos — a gravação falha em silêncio e o usuário vê "salvo com sucesso" sem foto alguma.
  - No formulário simplificado, ao editar, todas as fotos existentes são apagadas antes de reinserir. Se a reinserção for bloqueada, o RDO **perde** as fotos que já tinha.

## Correções

### 1. Permissão de gravação de fotos (banco)
Substituir a regra atual de `report_photos` por uma que também permita gravar quando o usuário tem acesso ao projeto/unidade do RDO (inclusive RDOs sem criador vindos do WhatsApp), reutilizando as funções já existentes de acesso a projeto/unidade. O mesmo ajuste será aplicado às tabelas irmãs usadas na mesma edição, se apresentarem o mesmo bloqueio.

### 2. Falha silenciosa (frontend)
- `src/pages/ReportForm.tsx`: verificar o erro nos inserts/deletes de `report_photos` e lançar/avisar quando falhar, em vez de ignorar.
- `src/pages/SimplifiedReportForm.tsx`: idem, e trocar o padrão "apaga tudo e reinsere" por diferença (remove só o que saiu, insere só o que entrou), para nunca perder fotos já salvas quando a gravação falhar.
- Mostrar toast de erro claro ("Não foi possível salvar as fotos") em vez de "Relatório salvo com sucesso".

### 3. Verificação
- Salvar um RDO novo com fotos e reabrir.
- Editar um RDO criado pela IA do WhatsApp, adicionar e remover fotos, reabrir e conferir.
- Conferir no banco a contagem de fotos por RDO antes/depois.

## Detalhes técnicos

- Nova policy `ALL` em `public.report_photos` com `USING`/`WITH CHECK` combinando: criador do RDO, papéis administrativos, `user_has_project_access(auth.uid(), r.project_id)` e acesso por unidade (`portal_user_site_ids`).
- Frontend: capturar `{ error }` de cada chamada Supabase de fotos e propagar no `try/catch` do submit.
