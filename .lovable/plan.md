## Problema

Ao salvar o relatório, o insert em `report_attendance` quebra com:

```
violates foreign key constraint "report_attendance_user_id_fkey"
```

A coluna `report_attendance.user_id` é FK para `profiles(id)` (ON DELETE SET NULL). O erro indica que algum `user_id` enviado no insert não existe (mais) na tabela `profiles` — provavelmente um colaborador cujo profile foi excluído, ou um ID vindo do parser de IA / dados antigos que não corresponde a um profile real.

Como a FK já é `ON DELETE SET NULL` e o esquema permite `user_id` nulo, a forma correta de tratar é **sanitizar antes do insert**: validar quais `user_id` existem em `profiles` e substituir os ausentes por `null` (mantendo o `user_name`, que já é gravado em texto).

## Mudanças

Arquivos envolvidos (apenas frontend, sem alterar schema):

1. `src/pages/ReportForm.tsx` — caminhos de criação (linha ~673) e atualização (linha ~571) do attendance.
2. `src/pages/SimplifiedReportForm.tsx` — inserts em `report_attendance` (linhas ~414 e ~628).
3. `src/components/reports/QuickReportFormContent.tsx` — se também faz insert direto, aplicar o mesmo tratamento.

Em cada local, antes do insert/update:

- Coletar todos os `userId` não-nulos do `attendance`.
- Fazer um `select id from profiles where id in (...)` único.
- Montar um `Set` de IDs válidos.
- Ao mapear para o insert, se `userId` não estiver no set, enviar `user_id: null` (preservando `user_name`).

Sem mudanças no banco, sem mudança de RLS, sem mudança no fluxo de UI. Apenas saneamento defensivo dos dados enviados.

## Resultado esperado

- O relatório passa a ser salvo mesmo quando algum colaborador da lista não tem profile correspondente.
- Os nomes continuam aparecendo no efetivo (via `user_name`), só perdem o vínculo com o profile inexistente.
- Sem mais erro de FK ao criar/editar relatório.