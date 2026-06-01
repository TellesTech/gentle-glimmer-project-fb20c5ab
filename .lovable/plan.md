## Problema

Ao abrir um RDO (ex.: `/reports/7b8acda6-...`) o `super_admin` vê o cabeçalho, mas:
- Fotos não aparecem
- Mão de obra (atendimento) não aparece
- Ocorrências/desvios não aparecem
- Métricas/atividades vêm zeradas

No banco, o RDO tem 9 atividades, 7 fotos, 3 trabalhadores. O problema é RLS.

## Causa raiz

As políticas de SELECT das tabelas filhas do RDO permitem leitura apenas para:
- Criador do relatório
- Membros do team
- Mesma `company_id` no `profiles`
- Roles `director` / `supervisor`

O role **`super_admin` está ausente** em todas as políticas de leitura — mesmo padrão do bug já corrigido em `reports`. Como o super_admin não pertence à `company_id` do projeto, o PostgREST retorna `[]` para as relações aninhadas (`activities`, `photos`, `attendance`, `deviations`, etc.), e a tela mostra "incompleto".

Tabelas afetadas:
- `report_photos`
- `report_activities`
- `report_attendance`
- `report_deviations`
- `report_equipment`
- `report_signatures`

## Correção

Criar uma migration que recria as policies de SELECT (e ALL/manage) dessas seis tabelas adicionando `has_role(auth.uid(), 'super_admin')` ao OR existente. Mantém todas as condições atuais (criador, team, company, director, supervisor, cliente aprovador) — só amplia para super_admin.

Estrutura por tabela:

```text
DROP POLICY "Users can view related ..." ON public.<tbl>;
CREATE POLICY "Users can view related ..." ON public.<tbl>
FOR SELECT USING (
  EXISTS (SELECT 1 FROM reports r WHERE r.id = <tbl>.report_id AND (
    r.created_by = auth.uid()
    OR r.team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR r.project_id IN (SELECT p.id FROM projects p WHERE p.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);

DROP POLICY "Report creators can manage ..." ON public.<tbl>;
CREATE POLICY "Report creators can manage ..." ON public.<tbl>
FOR ALL USING (
  EXISTS (SELECT 1 FROM reports WHERE reports.id = <tbl>.report_id AND (
    reports.created_by = auth.uid()
    OR has_role(auth.uid(),'admin'::user_role)
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'leader'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);
```

Aplicar para as 6 tabelas. Sem mudanças no frontend.

## Validação

Depois da migration, recarregar `/reports/7b8acda6-06cf-4d98-b174-af75fa566506` e confirmar:
- 9 atividades listadas
- 7 fotos na galeria
- Mão de obra com 3 trabalhadores
- Métricas e desvios populados