# Ajuste da resposta automática do RDO via WhatsApp

## Problema
Hoje, quando o usuário envia o texto do RDO no grupo, o bot responde com um bloco enorme: lista de campos preenchidos + resumo técnico da IA + pedido de fotos. As fotos enviadas em seguida são anexadas, mas a mensagem de "registrado com sucesso" nunca é dada de forma clara — só aparece "📸 Foto N anexada ao RDO #X".

O usuário quer:
1. Resposta inicial (após parser do texto) curta e objetiva.
2. Mensagem "RDO registrado com sucesso" apenas **depois** que as fotos forem recebidas.

## Mudanças em `supabase/functions/uazapi-webhook/index.ts`

### 1. Resposta após parsing do texto do RDO (linhas ~1637-1672)
Substituir o bloco que monta `confirmMsg` (lista de campos + resumo técnico da IA + "envie as fotos") por uma mensagem enxuta:

```
📝 RDO #<rdoCode> recebido. Envie as fotos agora — confirmarei o registro assim que forem anexadas.
```

- Remover a montagem de `filledFields`.
- Remover a concatenação do `aiSummaryText` na mensagem do WhatsApp (o resumo da IA continua sendo gerado e salvo no banco normalmente, apenas não vai mais para o grupo).
- Manter a indicação de atividade (`📁 Atividade: ...`) somente quando houver auto-criação ou múltiplas atividades, em uma linha curta.

### 2. Confirmação após anexar fotos
Hoje há dois caminhos que anexam fotos:

**a) `attachPendingPhotos` (linha ~326-329)** — usado quando o texto chega depois das fotos.  
Trocar:
```
📸 N fotos anexadas ao RDO #X
```
por:
```
✅ RDO #X registrado com sucesso (N foto(s) anexada(s))
```

**b) Fluxo de foto isolada após RDO existente (linha ~1013-1016)** — usado quando a foto chega depois do texto.  
Trocar:
```
📸 Foto N anexada ao RDO #X
```
por:
```
✅ RDO #X registrado com sucesso (N foto(s) anexada(s))
```

Em ambos os casos, `N` é o total de fotos do report após o anexo (já calculado via `count` no fluxo b; no fluxo a, calcular `count` em `report_photos` após o loop).

## Fora de escopo
- Geração do resumo técnico pela IA (continua salvando em `reports`).
- Lógica de parsing, mapeamento de grupos, normalização de `group_id`.
- UI do app web.

## Validação
1. Enviar texto de RDO no grupo "RDO - TESTE" → bot deve responder apenas `📝 RDO #X recebido. Envie as fotos agora...`.
2. Enviar 2 fotos → bot deve responder `✅ RDO #X registrado com sucesso (2 foto(s) anexada(s))`.
3. Confirmar via logs da função que o `aiSummaryText` continua sendo persistido na coluna correspondente de `reports`.
