## Problema

A edge function `import-collaborators` usa `google/gemini-2.0-flash-001`, modelo não mais disponível no Lovable AI Gateway. O Gateway retorna 400 com a lista de modelos permitidos, causando o erro "Edge Function returned a non-2xx status code".

## Correção

Atualizar `supabase/functions/import-collaborators/index.ts` trocando o modelo para `google/gemini-2.5-flash` (substituto direto, rápido e gratuito durante o período promocional do Lovable AI).

Nenhuma outra alteração necessária — o resto do fluxo (auth, parsing, import) está funcional.