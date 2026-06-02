Causa raiz: a tabela `public.profiles` não tem GRANTs para os roles `authenticated`/`service_role`, então a Data API retorna vazio mesmo com RLS permitindo. Como o seletor de colaboradores no modal "Colar Relatório do WhatsApp" depende de `allProfiles`, ele recebe lista vazia e a IA não consegue identificar ninguém (0/7).

Correção:

1. Migration: adicionar GRANTs em `public.profiles`
   - `GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated`
   - `GRANT ALL ON public.profiles TO service_role`
   - Sem grant para `anon` (todas as policies exigem usuário autenticado).

2. Verificar outras tabelas usadas pelo formulário rápido (`teams`, `team_members`, `projects`, `user_roles`) e adicionar GRANTs onde estiverem faltando, para evitar o mesmo problema silencioso.

3. Não alterar código do frontend nem do edge function — o matcher já foi reforçado na rodada anterior.