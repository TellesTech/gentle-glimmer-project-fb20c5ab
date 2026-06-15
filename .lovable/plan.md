## Objetivo

No card **Log de Mensagens** (Configurações → WhatsApp), exibir a **identificação do grupo** em todas as mensagens, não só o ID numérico cru.

## O que muda (apenas frontend)

Arquivo: `src/components/settings/WhatsAppSettingsTab.tsx` — bloco da lista de logs (linhas ~694–736).

Para cada item do log, montar um rótulo de grupo com a seguinte lógica, usando o `mappings` já carregado:

1. Construir um `Map<group_id, { group_name, site_name, company_name }>` a partir de `mappings` (já vem com `sites(name, companies(name))`).
2. Para cada `log`:
   - Se `log.group_id` termina com `@s.whatsapp.net` (ou não contém dígitos de grupo): exibir badge **"Conversa privada"** + número do telefone formatado.
   - Se `log.group_id` está mapeado: exibir em destaque o **nome do grupo** + **unidade / empresa** vinculada (ex.: `Grupo Obra Central · CSN – Volta Redonda`), e abaixo o ID em fonte mono pequena.
   - Se `log.group_id` existe mas não está mapeado: exibir **"Grupo não mapeado"** + ID em mono + manter botão **"Usar"** já existente para cadastrar.
   - Se não houver `group_id`: exibir **"Origem desconhecida"**.
3. Manter status, data, mensagem de erro e botão "Usar" como já estão.

## Detalhes visuais

- Linha 1: nome do remetente · badge de status · badge de origem (Grupo mapeado / Não mapeado / Conversa privada).
- Linha 2 (nova): **nome do grupo** em `font-medium` quando mapeado, com sufixo `· {unidade}` em `text-muted-foreground`.
- Linha 3: ID em `font-mono text-[10px]` + botão "Usar" (somente para grupos não mapeados).

## Fora de escopo

- Não altera webhook nem schema do banco.
- Não altera lógica de processamento de RDOs.
- Não mexe em outras seções da página.