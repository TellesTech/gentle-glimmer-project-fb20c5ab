## PRD WEES — Diário de Obra Pro

Vou gerar um **PRD detalhado** como artefato Markdown + PDF em `/mnt/documents/`, baseado na exploração real do código (rotas em `App.tsx`, design system em `index.css`, edge functions, hooks, e tabelas Supabase já existentes).

### Estrutura do documento

1. **Visão geral do produto**
   - Propósito (Diário de Obra digital — RDO), público-alvo (construtoras, engenharia, gestores de obra, clientes finais), proposta de valor, principais KPIs.
   - Stack: React 18 + Vite + TS + Tailwind + shadcn/ui + Supabase (Lovable Cloud) + Edge Functions + IA Gateway.

2. **Personas & papéis**
   - `super_admin`, `admin`, `collaborator`, `client_contact`, `portal_admin` — permissões, jornadas-chave.

3. **Arquitetura de informação & mapa de telas**
   - Diagrama da hierarquia: Empresa → Site → Projeto → Relatório (RDO) → Atividades / Mão de Obra / Fotos / Assinaturas.
   - Mapa completo de rotas (de `App.tsx`), agrupadas em: Públicas, Auth, App interno, Portal do Cliente, Super Admin.

4. **Design System — "Project Phoenix / Wees Edition"**
   - Tokens completos extraídos de `index.css` e `tailwind.config.ts`: cores HSL (light/dark), gradientes, sombras, raio, tipografia (Inter / Open Sans / JetBrains Mono), escala modular StarkType, animações (float, shimmer, pulse-glow), glassmorphism.
   - Componentes shadcn customizados, padrões de badge de status, navegação (Sidebar fixa desktop / BottomNav mobile / ManagementDrawer).
   - Regras de acessibilidade, breakpoints, padrões de espaçamento e elevação.

5. **PRD tela por tela** (≈ 35 telas)
   Para cada tela: objetivo, usuário-alvo, rota, componentes principais, estados (loading/empty/error), regras de negócio, integrações (Supabase tables + edge functions), eventos analytics. Telas cobertas:

   - **Públicas / Auth**: SalesPage (`/pv`), Login, Register, ForgotPassword, ResetPassword, InitialSetup, Diagnostico, NotFound.
   - **Portal do Cliente**: ClientLogin (slug), ClientDashboard, ClientReports, ClientReportView, ClientActivityList, ClientProfile, ClientPortalUsers, ClientPortalPicker.
   - **App interno (MainLayout)**: HomeRedirect, Reports, QuickReportWizard, SimplifiedReportForm, ReportForm completo, ReportDetail, ServiceReportBuilder, ServiceReportEditor, ProjectCalendar, SiteDashboard, CompanyDashboard, Teams, TeamDetails, Users, WorkforceDatabase, AIAssistant, SuggestionsRoadmap, Settings.
   - **Admin**: AdminExports, AdminSignatures, AdminBackup, AdminDataQuality, ImpactMetrics, ApiKeys.
   - **Super Admin**: SuperAdminPanel, SystemAgents.

6. **Fluxos críticos (com diagramas ASCII)**
   - Criação de RDO (Wizard → Simplified → ReportDetail → Assinatura → PDF).
   - Vinculação de HH (workforce → profiles, com base no que já foi auditado).
   - Portal do cliente (slug → login → assinatura).
   - Geração de Service Report assistido por IA.

7. **Modelo de dados resumido**
   Lista das principais tabelas (`profiles`, `user_roles`, `companies`, `sites`, `projects`, `reports`, `report_attendance`, `workforce_database`, `service_reports`, `signatures`, `portal_admin_access`, `client_contacts`, `suggestions`, etc.) com propósito e relações.

8. **Edge functions & integrações**
   Tabela com cada função (`generate-report-summary`, `generate-service-report`, `ai-assistant`, `parse-afd`, `zapi-*`, `submit-signature`, `bulk-import-collaborators`, `chat-onboarding`, etc.), propósito, entradas/saídas, secrets necessários.

9. **Roadmap & métricas de sucesso** (placeholder com base em `SuggestionsRoadmap` e `ImpactMetrics`).

10. **Anexos**: glossário, convenções de nomenclatura, política de RLS/segurança (user_roles + has_role), padrão de slugs reservados.

### Entrega

Dois arquivos em `/mnt/documents/`:
- `PRD_WEES_DiarioDeObraPro.md` (fonte editável)
- `PRD_WEES_DiarioDeObraPro.pdf` (gerado via pandoc/weasyprint)

Sem alterações no código da aplicação — apenas leitura de arquivos existentes para extrair informação fiel.

### Observação

Documento estimado em 25–40 páginas. Se preferir um recorte (ex.: só o design system, ou só o portal do cliente), me diga antes que eu inicie a geração.
