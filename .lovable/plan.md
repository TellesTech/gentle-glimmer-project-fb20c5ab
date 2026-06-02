## Diagnóstico

- A tela está puxando os perfis: a Edge Function recebeu `Registered names count: 221`, então `allProfiles` está chegando na IA.
- A política RLS de `profiles` também já permite leitura para `super_admin`, então não parece ser bloqueio de banco.
- No texto enviado, alguns campos marcados como “não encontrados” realmente não existem:
  - Rádio Operação
  - Ponto ambulância
  - Revalidação bloqueio
  - Supervisor
  - Responsável técnico
  - Comentários
- O campo “Desvio” veio como `Desvio N/A`; a IA interpretou corretamente como nenhum desvio, mas as frases logo depois foram tratadas como atividades.
- O efetivo tem 17 linhas, mas uma delas está sem nome: `9.N1-✅`. Por isso a IA extrai 16 pessoas válidas.
- Há um bug no `matchCollaborator`: o fallback de procurar um nome em qualquer parte do cadastro fica inacessível quando não encontra candidato pelo primeiro nome. Isso atrapalha casos como `Erivan` → `Francisco Erivan...` e nomes intermediários.

## Plano de correção

1. Ajustar o matching de colaboradores em `ParseReportModal.tsx`
   - Mover o fallback de “token em qualquer posição do nome” para antes do retorno nulo.
   - Permitir que nomes de uma palavra encontrem colaboradores cadastrados quando o token aparece no meio do nome completo.
   - Manter proteção contra ambiguidade: se houver mais de um resultado possível, continuar sem vincular automaticamente.
   - Ignorar itens vazios do efetivo, como `N1-✅`, para não contar como colaborador não encontrado.

2. Melhorar a extração na Edge Function `parse-report-text`
   - Ensinar explicitamente que `Número da OS` também deve preencher `numeroOM`, além de `OM`.
   - Reforçar que `Ponto de Encontro` preenche somente `pontoEncontro` e que `pontoAmbulancia` só deve ser preenchido quando existir ponto de ambulância no texto.
   - Reforçar que `Desvio N/A` significa nenhum desvio, e que textos após isso podem ser atividades, não comentários ou desvios.
   - Atualizar o modelo para o padrão atual do AI Gateway (`google/gemini-3-flash-preview`) para melhorar consistência de extração.

3. Validar com o texto que você enviou
   - Testar a Edge Function com o mesmo relatório.
   - Confirmar que continuam sendo preenchidos: data, local, período, rádio Wees, OS/OM, título, ponto de encontro, chegada/liberação, bloqueio e atividades.
   - Confirmar que os campos ausentes continuam corretamente como “não encontrados”.
   - Confirmar que o efetivo deixa de contar a linha sem nome e melhora os vínculos por nome intermediário.