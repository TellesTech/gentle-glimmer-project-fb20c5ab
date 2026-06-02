## Problema

O erro `IDLE_TIMEOUT (150s)` ocorre porque a edge function `import-collaborators` processa todos os 214 colaboradores em série (cada um cria um auth user + profile + role, ~500ms cada → ~107s+ e ultrapassa o limite). Importações grandes sempre vão estourar.

## Solução

Importar em **lotes (chunks)** a partir do cliente, chamando a edge function várias vezes com até ~25 colaboradores por chamada. Isso mantém cada chamada bem abaixo do limite de 150s e permite mostrar progresso.

## Mudanças

### 1. `src/components/users/ImportCollaboratorsDialog.tsx`
- Em `handleImport`, dividir `selected` em chunks de 25.
- Loop sequencial: para cada chunk chamar `supabase.functions.invoke('import-collaborators', { body: { action: 'import', collaborators: chunk } })`.
- Acumular `imported` e `errors` de todas as respostas.
- Adicionar estado `importProgress` (`{ done, total }`) e exibir na tela de `importing` ("Importando 50 de 214...").
- Toast final consolidado com total importado e total de erros.
- Se um chunk falhar com erro de rede, continuar os próximos e registrar o erro.

### 2. `supabase/functions/import-collaborators/index.ts`
- Nenhuma mudança de lógica necessária; ela já aceita arrays de qualquer tamanho.
- (Opcional) Adicionar log do tamanho do lote recebido para facilitar debug futuro.

## Resultado esperado

- 214 colaboradores → ~9 chamadas de 25 → cada chamada ~12s, bem abaixo do timeout.
- Usuário vê progresso em tempo real.
- Sem mudanças no fluxo de duplicatas, seleção ou UI de preview.
