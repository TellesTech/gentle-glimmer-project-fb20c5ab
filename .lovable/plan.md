# Corrigir "RDO #?" e confirmação quando foto vem com o texto

## Diagnóstico (confirmado nos logs e no banco)

1. **RDO #?**: a mensagem caiu no branch de **atualização** de um RDO existente (mesmo remetente + data + turno). Esse branch não calcula `rdo_number`, e há **43 RDOs com número nulo** no banco — quando atualiza um deles, a consulta retorna `null` e a mensagem mostra `#?`.
2. **Imagem com texto não conclui**: quando a foto vem **junto com o texto** do RDO, a foto até é anexada, mas o bot ainda responde "RDO recebido. Envie as fotos agora…" em vez de "concluído e salvo".

## Mudanças

### 1. Edge function `uazapi-webhook`
- **Branch de atualização**: antes do `update`, verificar se o RDO existente tem `rdo_number` nulo; se sim, calcular `max(rdo_number)+1` do projeto e incluir no update. Nunca mais aparecerá `#?`.
- **Foto junto com texto**: se a mensagem trouxe imagem e ela foi anexada com sucesso, responder direto com `✅ RDO #X concluído e salvo no sistema (N foto(s) anexada(s))` em vez de pedir as fotos.

### 2. Migração (backfill)
- Preencher `rdo_number` dos 43 RDOs nulos, numerando em sequência por projeto a partir do maior número existente.

## Validação
- Enviar no grupo "RDO - TESTE":
  - Texto + foto na mesma mensagem → resposta `✅ RDO #X concluído e salvo…` com número real e foto registrada.
  - Texto sozinho → `📝 RDO #X recebido…`, depois foto → `✅ RDO #X concluído…`.
