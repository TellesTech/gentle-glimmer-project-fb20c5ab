# Ocultar pastas de mês no portal do cliente

Permitir que apenas o super admin oculte pastas de mês (ex.: "Fevereiro 2026") no portal. Clientes deixam de ver a pasta oculta; o super admin continua vendo, marcada como oculta, e pode reexibir.

## Como funciona

- Cada pasta de mês passa a ter um botão de olho (mostrar/ocultar), visível **somente** para usuários com papel `super_admin`.
- Ao ocultar: a pasta some para todos os contatos do cliente daquela unidade. Para o super admin ela fica esmaecida com o selo "Oculto".
- Ao clicar de novo no olho, a pasta volta a ficar visível.
- O ocultamento é por **unidade (site)**: ocultar "Fevereiro 2026" na Arcelor Pecém não afeta outras unidades.
- Contatos do cliente não veem o botão nem conseguem alterar (bloqueio também no banco, não só na tela).

## Detalhes técnicos

Banco (migração):
- Nova tabela `public.portal_hidden_months` com `company_id`, `site_id`, `year`, `month`, `hidden_by`, `created_at` e chave única (`site_id`, `year`, `month`).
- GRANTs: `SELECT` para `authenticated`; `INSERT/DELETE` para `authenticated`; `ALL` para `service_role`.
- RLS: leitura liberada a usuários autenticados (necessária para filtrar as pastas); escrita/remoção apenas quando `public.is_super_admin(auth.uid())`.

Frontend:
- `src/pages/client/ClientDashboard.tsx`: query dos meses ocultos da unidade atual; filtrar `monthFolders` para não-super-admin; botão de olho + selo "Oculto" no card do mês para super admin; mutations de ocultar/reexibir com invalidação da query e toast.

## Fora do escopo

- Ocultar RDOs individuais ou pastas de atividade (apenas mês, conforme pedido).
