## Diagnóstico

O erro atual não é falta de dados nem problema no modal: a Edge Function publicada ainda está chamando o modelo antigo `google/gemini-2.0-flash-001`, e o Lovable AI Gateway rejeita com `400 invalid model`.

No arquivo local já aparece `google/gemini-3-flash-preview`, então o problema provável é que a função publicada no Supabase não foi redeployada após a alteração anterior.

## Plano de correção

1. Reimplantar a Edge Function `generate-service-report` para publicar a versão local corrigida.
2. Testar a função implantada com o mesmo payload do erro atual:
   - `project_id`: `4d114afb-0449-4b5e-8ab6-fdf48751e7aa`
   - `site_id`: `3b9d33c6-4587-4088-b30e-a9062b05396f`
   - `period_start`: `null`
   - `period_end`: `null`
3. Conferir os logs da Edge Function após o teste para confirmar que ela chama `google/gemini-3-flash-preview` e não retorna mais `AI error: 400`.
4. Se ainda houver erro 400, trocar a chamada manual `fetch` para o padrão recomendado do Lovable AI Gateway com AI SDK/OpenAI-compatible, preservando o schema estruturado do relatório.
5. Melhorar a mensagem retornada ao app para exibir o detalhe real do gateway quando houver erro de IA, em vez de apenas `AI error: 400`.

## Arquivos envolvidos

- `supabase/functions/generate-service-report/index.ts`

## Resultado esperado

O botão “Gerar Relatório com IA” deixa de falhar com `Edge Function returned a non-2xx status code` por modelo inválido, e o relatório volta a ser gerado com a versão atual do Lovable AI Gateway.