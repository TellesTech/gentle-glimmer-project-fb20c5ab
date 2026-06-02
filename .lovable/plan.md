## Diagnóstico

O erro atual acontece ao salvar o efetivo do RDO:

`Could not find the 'function_role' column of 'report_attendance' in the schema cache`

A tela está enviando o campo `function_role` para a tabela `report_attendance`, mas essa coluna não existe no banco. A tabela hoje tem apenas: `id`, `report_id`, `user_id`, `user_name`, `present`, `arrival_time`, `departure_time`, `notes`, `created_at`.

## Plano de correção

1. **Adicionar a coluna faltante no banco**
   - Criar uma migration adicionando `function_role` em `public.report_attendance`.
   - Tipo sugerido: `text`, opcional, para armazenar a função/cargo do colaborador no efetivo.

2. **Atualizar os tipos do Supabase**
   - Ajustar `src/integrations/supabase/types.ts` para incluir `function_role` em `report_attendance`.

3. **Manter o formulário como está**
   - O código do formulário já envia e lê `function_role` corretamente em criação e edição.
   - Depois da coluna existir, o salvamento do efetivo deve passar.

4. **Validação final**
   - Conferir no schema se a coluna foi criada.
   - Revisar se a inserção enviada pela tela bate com as colunas reais da tabela.

## Resultado esperado

Após aplicar a migration, o RDO deve conseguir salvar o efetivo com função/cargo sem cair no erro de schema cache.