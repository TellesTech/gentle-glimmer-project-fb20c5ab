Plano de correção:

1. Corrigir a visibilidade dos colaboradores no banco
- O app está recebendo apenas o perfil do usuário logado na consulta de `profiles`.
- O usuário atual tem papel `super_admin`, mas a política de leitura de `profiles` não inclui `super_admin`.
- Ajustar a política de leitura para que `super_admin` consiga ver todos os colaboradores cadastrados, mantendo as demais regras atuais.

2. Melhorar o reconhecimento de nomes no modal
- Reutilizar no frontend uma lógica de correspondência mais robusta, parecida com a já usada no webhook do WhatsApp.
- Remover tokens de função/cargo antes de comparar nomes.
- Aceitar correspondências por sobrenome/token interno, por exemplo `Wellington` com `Jose Wellington Araujo de Souza`.
- Corrigir pequenos erros de digitação, por exemplo `Mardem` com `Marden` e `Bernado` com `Bernardo`.
- Evitar marcar colaboradores como identificados quando houver empate real sem confiança.

3. Melhorar o envio de referência para a IA
- Após a política corrigida, o modal enviará a lista real de colaboradores cadastrados para a função `parse-report-text`.
- Isso ajuda a IA a devolver nomes já normalizados conforme o cadastro.

4. Validar o fluxo completo
- Testar a consulta de `profiles` depois da migração.
- Testar a função `parse-report-text` com o texto do print.
- Validar que o modal passa a mostrar os colaboradores identificados e que os campos continuam preenchendo corretamente.

Detalhes técnicos:
- Migration SQL para atualizar a política de leitura de `public.profiles` incluindo `public.has_role(auth.uid(), 'super_admin')`.
- Alteração em `src/components/reports/ParseReportModal.tsx` na função `matchCollaborator`.
- Se necessário, pequeno ajuste em `supabase/functions/parse-report-text/index.ts` para reforçar que nomes da lista cadastrada devem ser preferidos quando houver correspondência próxima.