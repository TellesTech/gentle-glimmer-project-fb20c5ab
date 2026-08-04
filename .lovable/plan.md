# Corrigir portal do cliente: convite, PIN e link de acesso

## O problema

O erro "Could not find the function public.get_company_login_contacts" não é um caso isolado. Verifiquei o banco: **nenhuma** das funções que o portal do cliente usa existe hoje. As chamadas presentes no código são:

- `get_company_login_contacts` — lista contatos da unidade (diálogo "Gerar Convite" e tela de login)
- `resolve_company_slug` / `resolve_site_slug` — traduzem `rdo.wees.com.br/empresa/unidade` em IDs
- `get_company_public_info` / `get_company_portal_settings` — dados e visual da tela de login
- `get_company_login_stats` / `get_site_login_stats` — números exibidos no login
- `get_portal_collaborator` — responsável WEES exibido no login da unidade
- `get_portal_wees_responsibles` — card de responsáveis no portal
- `resolve_client_portal_branding` — logo/nome no cabeçalho do portal
- `get_user_project_ids`

Além disso, a tela de login lê `sites.portal_collaborator_id`, coluna que também não existe na tabela `sites`.

Resultado prático: o convite não lista ninguém e o link gerado (`/empresa/unidade`) quebra ao abrir, mesmo com o PIN gravado corretamente.

O PIN em si já está correto: `send-client-invitation` exige 4 dígitos, gera o hash (salt:hash SHA-256) e grava em `company_contacts.pin_hash`; `validate-pin` usa o mesmo algoritmo. O que falta é o restante da cadeia.

## O que será feito

### 1. Migração no banco (uma única migração)
Criar todas as funções acima como `SECURITY DEFINER` com `search_path = public`, liberadas ao visitante anônimo apenas no que é público de login (nome/logo da empresa, cores do portal e lista de contatos com nome, e-mail, foto, cargo e os sinalizadores "tem PIN" / "tem acesso" — nunca o hash do PIN), e restritas a usuários autenticados nas funções internas do portal.

Também adicionar a coluna `portal_collaborator_id` em `sites` (referência opcional a um perfil interno WEES), usada no login da unidade.

Regras de retorno principais:
- `get_company_login_contacts(p_company_id, p_site_id)` — contatos ativos da empresa; quando a unidade é informada, apenas os vinculados a ela via `contact_sites`.
- `resolve_company_slug` / `resolve_site_slug` — comparação por slug normalizado (minúsculas, sem espaços).
- Estatísticas de login calculadas a partir de `reports`, `report_signatures` e `projects` da empresa ou da unidade.

### 2. Verificação do fluxo ponta a ponta
- Abrir o diálogo "Gerar Convite" e confirmar que Lucas Rosa (Suzano Aracruz) aparece na lista.
- Gerar o convite com PIN de 4 dígitos e confirmar que o texto traz link, e-mail e PIN.
- Abrir o link gerado (`/{slug-empresa}/{slug-unidade}`) e confirmar que a tela de login carrega, mostra o contato e aceita o PIN.
- Rodar o linter de segurança e corrigir o que vier da migração.

## Notas técnicas
- O convite exige contato com unidade vinculada (`contact_sites`). Vou confirmar que Lucas Rosa está vinculado a Suzano Aracruz e sinalizar caso não esteja.
- Empresas/unidades sem `slug` continuam caindo no ID — o link segue funcional.
- Nenhuma alteração no algoritmo de PIN ou senha: apenas a camada que faltava.