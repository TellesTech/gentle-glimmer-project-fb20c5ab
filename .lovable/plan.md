Plano para corrigir a listagem de atividades e RDOs no Gabinete de Documentos:

1. Corrigir a causa principal no acesso aos RDOs
- Hoje o usuário logado é `super_admin`, mas a política de leitura de `reports` não inclui `super_admin`.
- Resultado observado no preview: a chamada para `reports` volta `[]`, mesmo existindo 374 RDOs na unidade aberta.
- Vou criar uma migration ajustando as políticas de `reports` para incluir `super_admin` nas permissões de leitura, atualização e exclusão quando aplicável, sem abrir acesso público.

2. Corrigir o agrupamento das atividades por competência real
- Atividades com RDO serão listadas no mês/ano dos próprios RDOs.
- Atividades sem RDO serão listadas no mês/ano de `created_at`.
- Isso evita o erro atual em que a atividade aparece só no mês de criação e não aparece em meses posteriores onde existem RDOs.
- Exemplo validado no banco para Maio/2026 da unidade aberta: existem 8 atividades e 28 RDOs.

3. Remover filtros indevidos da busca do gabinete
- Manter apenas `archived_at is null` para RDOs ativos.
- Incluir todos os status existentes relevantes: `draft`, `completed`, `sent`, `signed` e `finalized`, se o enum aceitar.
- Continuar paginando em lotes de 1000 para não cair no limite do PostgREST.

4. Ajustar contadores e navegação
- Na unidade, ano e mês, mostrar contadores derivados das pastas montadas: atividades e RDOs.
- Garantir que o mês selecionado pela URL (`month=4`, Maio) encontre atividades que têm RDO em Maio, mesmo se a atividade foi criada em Abril.
- Quando a pasta de uma atividade for aberta, listar os RDOs daquele mês corretamente.

5. Validar depois da implementação
- Conferir via query que a unidade `ArcelorMittal Pecém` tem 51 atividades e 374 RDOs ativos.
- Conferir Maio/2026: 8 atividades e 28 RDOs.
- Verificar no preview que `/reports?...site=3b9d33c6-4587-4088-b30e-a9062b05396f&year=2026&month=4` mostra as atividades e os RDOs.