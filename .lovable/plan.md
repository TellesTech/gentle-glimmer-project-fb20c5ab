## Causa do problema

Existem **3 linhas** em `public.system_settings`:

| id (prefix) | logo_url | updated_at |
|---|---|---|
| `e4d4a316…` | vazio | 2026-06-01 13:03 |
| `b5f31494…` | vazio | 2026-06-01 13:20 |
| `28baf619…` | **com as logos novas** | 2026-06-02 12:09 |

A função `get_public_branding()` faz `SELECT … FROM system_settings LIMIT 1` **sem `ORDER BY`**. O Postgres devolve qualquer linha — e está devolvendo uma das vazias. Por isso `useSystemSettings` recebe `null` em todas as URLs e nada muda na interface, mesmo depois de salvar.

(Há também o efeito colateral: `Settings.tsx` faz `update … eq('id', systemSettings.id)`, então o salvamento pode estar gravando em qualquer uma das 3 linhas dependendo de qual a RPC retornou — o que explica por que algumas tentativas ficaram em rows diferentes.)

## Correção

Uma única migration, em sequência:

1. Manter apenas a linha mais recente em `system_settings` (deletar as duplicatas vazias).
2. Recriar `public.get_public_branding()` com `ORDER BY updated_at DESC NULLS LAST LIMIT 1` para sempre devolver a linha "fonte de verdade".
3. Adicionar índice único parcial para impedir múltiplas linhas no futuro (tabela singleton):
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS system_settings_singleton
   ON public.system_settings ((true));
   ```

Sem alterações de frontend — o `useSystemSettings` já está correto e o `refetch()` após salvar passa a trazer as URLs corretas imediatamente.

## Verificação após aplicar

- `SELECT count(*) FROM system_settings` deve retornar 1.
- `SELECT * FROM get_public_branding()` deve retornar a linha com `logo_url`, `pdf_logo_url`, `login_logo_url` e `favicon_url` preenchidos.
- A logo da sidebar, do header do cliente e do PDF devem atualizar após recarregar a página de Configurações.