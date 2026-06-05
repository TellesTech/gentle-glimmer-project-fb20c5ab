# Correção: fotos do WhatsApp não salvam no RDO

## Causa raiz

A edge function `zapi-webhook` faz upload das fotos recebidas via Z-API para um bucket chamado **`report-photos`**, mas esse bucket **não existe** no projeto. Os buckets reais são:

- `avatars`
- `service-report-photos` ← usado pelo restante do app para fotos de RDO/serviço
- `temp-backups`
- `company-photos`

Resultado: o upload falha silenciosamente (o código só insere em `report_photos` quando `uploadError` é falsy), nenhum registro é criado em `report_photos` e a foto nunca aparece no RDO.

Confirmação no código (`supabase/functions/zapi-webhook/index.ts`):
- linha 303-307 — anexar fotos pendentes
- linha 878-882 — foto isolada anexada a um RDO recente
- linha 1394-1397 — foto dentro do fluxo principal de RDO

Todas usam `.from("report-photos")`.

## O que será alterado

Trocar nas 3 ocorrências o nome do bucket de `report-photos` para `service-report-photos`, alinhando com o resto do sistema (formulário de RDO, `PhotoUploader`, etc.). Nenhuma outra lógica muda.

Arquivo alterado:
- `supabase/functions/zapi-webhook/index.ts`

## Validação

1. Enviar uma foto no grupo monitorado junto com um texto de RDO (como o exemplo do CSN/Serra).
2. Verificar nos logs da função `zapi-webhook` que não há erro de upload e aparece `Attached N pending photos to RDO #...` ou inserção em `report_photos`.
3. Abrir o RDO correspondente no app e conferir se a foto aparece na galeria.

## Observações

- Não é necessário criar bucket novo nem mexer em RLS — `service-report-photos` já é público e já é usado para fotos de relatório no app.
- Fotos anteriores enviadas pelo WhatsApp que falharam não serão recuperadas automaticamente (o binário não foi salvo em lugar nenhum). Apenas mensagens futuras passarão a funcionar.
