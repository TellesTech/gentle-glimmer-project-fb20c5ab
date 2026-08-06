# Integração Canva no Construtor de Relatórios de Serviço

## Ponto importante antes de começar

O conector Canva que existe hoje neste projeto é um **conector de chat (MCP)**: ele funciona para mim durante a construção, mas o app publicado **não consegue chamá-lo em tempo de execução**. Não existe conector Canva na lista de conectores de app do Lovable (verifiquei a lista completa).

Para o app usar o Canva de verdade, a integração precisa ser feita com a **Canva Connect API** usando uma conta única WEES:
- É necessário criar um app em `canva.com/developers` (conta WEES), com Client ID e Client Secret.
- Escopos necessários: `design:content:read`, `design:content:write`, `design:meta:read`, `asset:write`, `brandtemplate:meta:read`, `brandtemplate:content:read`.
- O token OAuth da conta WEES fica guardado no backend e é renovado automaticamente (refresh token).

Sobre "substituir o editor atual": o Canva **não permite embutir o editor dentro de outro site**. O que dá para fazer é o fluxo "abrir no Canva" — o relatório vira um design Canva e o usuário edita numa aba do Canva, trazendo o resultado (PDF/imagens) de volta para o sistema. Este plano segue esse caminho e mantém o editor interno como opção.

## O que será construído

### 1. Base da conexão (conta única WEES)
- Tabela `canva_connection` (token, refresh token, expiração, conta) — acesso apenas para super admin via RLS.
- Edge functions:
  - `canva-oauth-start` — gera a URL de autorização (PKCE).
  - `canva-oauth-callback` — troca o código pelo token e salva.
  - `_shared/canvaClient.ts` — obtém token válido, renova quando expirado e faz as chamadas à API.
- Tela em Configurações: "Integração Canva" (conectar / status / desconectar), visível só para super admin.

### 2. Exportar relatório para o Canva
- Botão **"Abrir no Canva"** no `ServiceReportBuilder` (card) e no `ServiceReportEditor` (barra superior).
- Fluxo: gera o PDF do relatório com o gerador atual → sobe para o Storage com URL temporária assinada → edge function `canva-export-report` chama o import da Canva Connect API → retorna o `design_id` e o link de edição.
- O `design_id` e a URL ficam gravados no relatório (`canva_design_id`, `canva_edit_url`, `canva_synced_at`) para reabrir sempre o mesmo design.
- Conteúdo enviado: tudo o que já vai no PDF (capa, unidade/empresa, data, títulos, seções de texto, fotos com legendas, rodapé/assinaturas).

### 3. Criar a partir de um template Canva (autofill)
- No diálogo de novo relatório, opção "Usar template do Canva".
- Lista os brand templates da conta WEES e faz o autofill com os campos do relatório (título, unidade, empresa, data, resumo, imagens principais).
- O design criado fica vinculado ao relatório.

### 4. Importar de volta / usar design existente
- Botão **"Sincronizar do Canva"**: exporta o design (PDF e PNG por página) e guarda no Storage, substituindo o PDF final do relatório.
- Opção de colar a URL de um design Canva existente para vincular a um relatório.
- Depois de sincronizar, o download do relatório usa a versão Canva.

## Ordem de entrega
1. Conexão OAuth + tela de status em Configurações.
2. Exportar para o Canva + botão de abrir/editar.
3. Sincronizar de volta (PDF/imagens).
4. Criação a partir de brand template (autofill).

## Detalhes técnicos
- Migração: tabela `canva_connection` (com GRANTs e RLS de super admin) e colunas `canva_design_id`, `canva_edit_url`, `canva_synced_at` em `service_reports`.
- Segredos: `CANVA_CLIENT_ID` e `CANVA_CLIENT_SECRET` (solicitados via formulário seguro após a aprovação do plano).
- Redirect URI do OAuth: endpoint da edge function `canva-oauth-callback` — precisa ser cadastrado no app Canva.
- Novas edge functions: `canva-oauth-start`, `canva-oauth-callback`, `canva-export-report`, `canva-import-design`, `canva-templates`.
- Frontend: `src/lib/canva.ts` (chamadas), botões em `ServiceReportBuilder.tsx` e `ServiceReportEditor.tsx`, aba de integração em `Settings.tsx`.
- Os jobs de export/import do Canva são assíncronos: as functions fazem polling do job até concluir.