## Objetivo
Incluir o nome de quem criou/atualizou o RDO nas mensagens de notificação.

## Alterações

**1. Migration — atualizar `notify_on_report_change`**
- Buscar o nome do autor em `profiles` usando `NEW.created_by` (para INSERT) e `auth.uid()` (para aprovação/envio).
- Mensagens novas:
  - **Criado**: `"RDO #X - PROJETO (DD/MM/AAAA) criado por NOME"`
  - **Aprovado**: `"RDO #X - PROJETO aprovado por NOME"`
  - **Enviado para assinatura**: `"RDO #X - PROJETO enviado para assinatura por NOME"`
- Fallback para "Usuário" quando o nome não for encontrado.

## Fora de escopo
- Notificações já existentes no banco (apenas novas terão o nome).
- UI do dropdown de notificações (já exibe `message` direto).