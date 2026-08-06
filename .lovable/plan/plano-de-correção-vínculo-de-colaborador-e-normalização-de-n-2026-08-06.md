# Plano de Correção: Vínculo de Colaborador e Normalização de Nomes

O usuário relatou que o colaborador **Fábio Carvalho Braga** foi cadastrado, mas não está sendo reconhecido como colaborador da **Suzano** no RDO. A IA estaria puxando outro nome ou falhando no vínculo.

## Análise do Problema
1.  **Perfil Encontrado:** `Fábio Carvalho Braga ` (com um espaço no final).
2.  **Vínculo de Empresa:** O perfil `a04ffcd3...` (Fábio) não possui entrada na tabela `user_companies` vinculada à Suzano (`7519c290...`).
3.  **Lógica de Match:** A função `matchCollaborator` no Edge Function `uazapi-webhook` e a `matchProfileByName` no frontend usam normalização, mas espaços residuais ou falta de vínculo explícito com o projeto/site podem causar ambiguidade, especialmente se houver outros "Fabios" no sistema.
4.  **Conflito de Nomes:** Existem pelo menos 4 "Fabios" no banco de dados. Sem o vínculo correto de empresa/projeto, a IA pode se confundir.

## Ações Propostas

### 1. Banco de Dados (Correção de Dados e Vínculos)
- Vincular **Fábio Carvalho Braga** à empresa **Suzano** na tabela `user_companies`.
- Limpar espaços em branco (trim) nos nomes da tabela `profiles`.
- Garantir que ele esteja em `project_members` para os projetos da Suzano.

### 2. Edge Function (`uazapi-webhook/index.ts`)
- Melhorar a normalização na função `matchCollaborator` para garantir que o `trim()` seja aplicado agressivamente.
- Refinar a lógica de desempate: se um colaborador pertence à empresa do projeto/site, ele deve ter prioridade máxima no match fuzzy.

### 3. Frontend (`resolveWorkerFunction.ts`)
- Atualizar `matchProfileByName` para ser mais resiliente a múltiplos nomes e espaços, seguindo a lógica aprimorada do Edge Function (Damerau-Levenshtein se necessário).

### 4. Interface (`WorkforceDatabase.tsx`)
- Garantir que a sincronização de RDOs (`syncFromRdos`) utilize a mesma lógica de resolução de nomes para evitar nomes "órfãos" no banco de dados de HH.

## Verificação
- Executar query para confirmar que Fábio agora aparece vinculado à Suzano.
- Simular (ou verificar logs) o processamento de um RDO da Suzano contendo "Fabio" para garantir que o ID correto seja atribuído.

---
**Pergunta para o usuário:** Deseja que eu vincule automaticamente todos os novos colaboradores cadastrados sob um contexto de "Unidade" à empresa dessa unidade?
