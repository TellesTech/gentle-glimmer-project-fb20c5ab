## Verificação

Testei a edge function `parse-report-text` diretamente com um trecho do efetivo e ela respondeu **200 OK**, extraindo `Rafael` e `Wellington` corretamente. Os logs mostram "Successfully parsed and normalized report data" sem erros.

Ou seja: o serviço está funcionando agora. O erro do screenshot ("Edge Function returned a non-2xx status code") foi pontual — provavelmente um dos seguintes:

- **429** rate limit do Lovable AI Gateway (muitas requisições seguidas)
- **402** créditos da workspace esgotados
- timeout/erro transitório do gateway

## O que proponho

Como não há bug reproduzível no momento, não há código para alterar. Sugiro apenas melhorar a mensagem de erro no front para o usuário entender a causa real quando acontecer:

1. Em `src/components/reports/ParseReportModal.tsx`, no `catch` do `supabase.functions.invoke('parse-report-text', ...)`, ler `error.context?.status` (ou o body de erro retornado) e exibir mensagens específicas:
   - 429 → "Muitas requisições. Aguarde alguns segundos e tente novamente."
   - 402 → "Créditos de IA esgotados. Adicione créditos em Configurações da Workspace."
   - Outros → manter a mensagem atual genérica.
2. Em `supabase/functions/parse-report-text/index.ts`, garantir que o `response.status` do gateway (429/402) seja repassado no retorno HTTP (status + JSON com `error`), para o front conseguir distinguir.

Nenhuma mudança em schema, RLS ou secrets.

## Fora de escopo

- Não vou alterar o prompt, o modelo ou a lógica de parsing.
- Não vou adicionar retry automático.

Se preferir só confirmar que está funcionando e não mexer no tratamento de erro, é só me dizer.