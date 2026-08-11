# Filtro de fábricas para Super Admin nos RDOs da IA

Hoje o super admin vê automaticamente todas as fábricas em "Meus RDOs" (inclusive os RDOs criados pela IA do WhatsApp), sem opção de escolher. O diálogo "Editar Colaborador" só mostra o aviso "Super admins têm acesso a todas as fábricas automaticamente".

## O que muda

1. **Escolha das fábricas no cadastro do super admin**
   - No diálogo "Editar Colaborador", quando o papel for Super Admin, aparece o seletor de fábricas (o mesmo já usado para os demais papéis), com o rótulo "Fábricas visíveis nos RDOs".
   - Texto de apoio: se nenhuma fábrica for marcada, o super admin continua vendo todas (comportamento atual). Ao marcar uma ou mais, a visualização passa a mostrar apenas essas.
   - Isso é apenas um filtro de visualização — as permissões de super admin continuam totais.

2. **"Meus RDOs" respeita a escolha**
   - A tela de RDOs (armário de documentos) passa a filtrar empresas, unidades, projetos e relatórios pelas fábricas escolhidas, inclusive os RDOs gerados automaticamente pela IA do WhatsApp.
   - Sem fábricas escolhidas, nada muda: vê tudo.

## Detalhes técnicos

- Reaproveitar `SiteAccessSelector` em `src/pages/Users.tsx`, removendo a condição `formData.role !== 'super_admin'` que hoje esconde o seletor, e manter o salvamento das atribuições já existente.
- Estender `src/hooks/useAdminSiteAccess.ts` para carregar `portal_admin_access` também quando `role === 'super_admin'` (hoje retorna vazio para esse papel).
- Em `src/components/reports/DocumentCabinet.tsx`, generalizar a flag `isRestrictedAdmin` para "escopo restrito" quando houver `siteIds` (admin **ou** super admin), aplicando o filtro nas consultas de empresas, unidades, projetos e relatórios (as chaves de query já incluem `siteIds`).
- Sem migração de banco: `portal_admin_access` e suas políticas já existem e o backend já valida quem pode gravar.