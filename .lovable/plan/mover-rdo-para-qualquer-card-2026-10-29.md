# Mover RDO para qualquer card

Hoje só dá para mover arrastando o RDO, e apenas para os cards que aparecem na lateral (mesmo mês). Vamos criar um jeito simples e direto de escolher o card de destino.

## O que muda para você

1. **Novo botão "Mover para outro card"** no menu (⋮) de cada RDO dentro da pasta, e também na página do RDO.
2. Ao clicar, abre uma janela com:
   - Campo de busca (por nome da atividade ou número da OM).
   - Lista de **todos os cards** da mesma fábrica/unidade (não só os do mês aberto), mostrando nome, OM e quantos RDOs tem.
   - Opção **"Criar novo card"** — digita o nome da atividade (e OM, se quiser) e o RDO vai para esse card novo.
   - Opção para trocar de fábrica/unidade, caso o WhatsApp tenha mandado para a fábrica errada.
3. Confirmação: "Mover RDO Nº X para o card Y?". Após mover, a tela atualiza na hora e o RDO aparece no card novo.
4. **Mover vários de uma vez**: caixa de seleção nos RDOs da pasta + botão "Mover selecionados".
5. O arrastar continua funcionando como hoje.
6. Cada movimentação fica registrada no histórico do RDO (de qual card para qual card, quem moveu).

## Regras
- Mesmas permissões de hoje: quem pode editar o RDO pode movê-lo.
- Assinaturas, fotos e número do RDO são mantidos.
- Se o card de origem ficar vazio, ele some da lista automaticamente.

## Detalhes técnicos
- Novo componente `MoveReportDialog` reutilizado em `DocumentCabinet.tsx` (menu do card + seleção múltipla) e na página de detalhe do RDO.
- Lista de destinos: consulta de `projects` filtrada por `company_id`/`site_id` (com troca opcional de fábrica/unidade).
- Mover = atualizar `reports.project_id` (+ `maintenance_order_number/title` do destino, e `company_id/site_id` se trocar de fábrica), reaproveitando a lógica de `mergeReportsMutation`.
- "Criar novo card" insere em `projects` e move em seguida.
- Registro em `report_history` com ação "moved".
- Invalidar `reports-cabinet-all-v2` e a consulta do detalhe do RDO.
