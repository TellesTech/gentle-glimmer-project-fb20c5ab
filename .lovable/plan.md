# Corrigir "Sem permissão para gerar relatório nesta unidade"

## Causa raiz

As tabelas `service_reports`, `service_report_sections` e `service_report_photos` têm RLS habilitado, mas:

- `service_reports` tem apenas **1 policy de SELECT** (`Users can view service reports from their company`).
- `service_report_sections` e `service_report_photos` **não têm policy nenhuma**.

Como não existe nenhuma policy de `INSERT/UPDATE/DELETE`, qualquer tentativa de criar um Relatório de Serviço (manual ou via IA) falha com `permission denied / 42501`. O front-end traduz isso para "Sem permissão para gerar relatório nesta unidade", mas o problema não é da unidade — é falta de policy.

Isso também afeta:
- Edição/exclusão de relatórios existentes.
- Inserir/editar seções e fotos em qualquer relatório.

## O que vou fazer

Criar uma migration adicionando as policies que faltam, escopadas por empresa (mesma regra já usada no SELECT), e mantendo super_admin com acesso total.

### service_reports

- `INSERT`: permitido quando `company_id = get_user_company_id(auth.uid())` ou `has_role(auth.uid(),'super_admin')` e `created_by = auth.uid()`.
- `UPDATE`: mesma regra (USING + WITH CHECK por empresa / super_admin).
- `DELETE`: mesma regra.

### service_report_sections e service_report_photos

Como ambas pertencem a um `service_report`, todas as policies (SELECT/INSERT/UPDATE/DELETE) usarão `EXISTS` para validar que o `report_id` (ou o `section_id → report_id`) pertence a um `service_report` visível pelo usuário pela mesma regra (empresa ou super_admin).

### GRANTs

Conferir e, se faltarem, garantir:
```
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_reports        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_report_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_report_photos   TO authenticated;
GRANT ALL ON public.service_reports, public.service_report_sections, public.service_report_photos TO service_role;
```

## Verificação após aplicar

1. Recarregar `/service-reports` e clicar em "Gerar Relatório com IA" no mesmo projeto onde deu erro — deve criar o rascunho e abrir o editor.
2. Editar/salvar uma seção do relatório gerado.
3. Como super_admin, validar que continua funcionando em qualquer empresa.

## Fora do escopo

- Não vou alterar o fluxo do `AIReportGeneratorDialog` nem a Edge Function `generate-service-report` — eles estão corretos; o bloqueio é puramente RLS.
- Não vou mexer em `reports` (RDOs) nem em colaboradores nesta tarefa.
