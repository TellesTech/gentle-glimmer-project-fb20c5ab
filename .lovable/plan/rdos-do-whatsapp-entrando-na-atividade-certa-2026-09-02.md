# RDOs do WhatsApp entrando na atividade certa

## O que os dados mostram (verificado)

- Nos últimos RDOs criados via WhatsApp, **o número da OM veio vazio em todos** (`maintenance_order_number = null`). O roteamento então cai no título, que varia a cada mensagem — por isso surgem cards como "Retirada da tubulação.", "Troca e Reparo na Tubulação Refrigeração 02." e "MANUTENÇÃO NOS CORRIMÃOS..." como atividades separadas, todas no grupo "RDO - WEES / REFRAMAX".
- Quando a OM existe, ainda há divergência de formato: a OM `24030` aparece gravada de duas formas (`24030` e `P/CE.AR.IN.24030.SME`) em 31 RDOs. O webhook compara OMs **só por dígitos**, mas o card em "Meus RDOs" agrupa pelo **texto** da OM — logo o mesmo serviço vira dois cards.
- Todos os grupos mapeados (`whatsapp_group_projects`) apontam só para a **unidade** (`site_id`); nenhum tem `project_id` definido. Não existe hoje uma atividade padrão por grupo.

## O que será feito

### 1. Chave única de OM entre webhook e cards
Usar a mesma normalização nos dois lados: comparar OM por dígitos, mas **gravar sempre o formato canônico já existente** na unidade. Se a unidade já tem RDOs com `P/CE.AR.IN.24030.SME`, uma mensagem com "24030" salva o mesmo texto canônico — o RDO cai no card existente em vez de abrir outro.

### 2. Roteamento por título mais tolerante
Hoje o webhook exige 70% de tokens iguais para reaproveitar uma atividade, e a mensagem precisa bater quase palavra por palavra. Alinhar o critério ao usado nos cards (mesma métrica de similaridade de `rdoActivityGroups`), ignorando pontuação final, plurais e palavras genéricas ("manutenção", "serviço", "reparo" isolados). Comparar também com o **título da OM dos RDOs já existentes** da unidade, não apenas com o nome do projeto.

### 3. Escopo pelo grupo do WhatsApp
- A busca por atividade candidata fica restrita à unidade mapeada do grupo (já é o caso) e passa a considerar também as atividades encerradas recentemente na mesma unidade, evitando recriar card por causa de status.
- Se o grupo tiver `project_id` definido, ele vira a atividade padrão quando a mensagem não traz OM nem título reconhecível — hoje esse caso vira card novo. Incluir na tela de mapeamento de grupos a opção de escolher a atividade padrão (opcional).

### 4. Criar nova atividade só quando realmente for outra
Nova atividade continua sendo criada quando: há OM explícita que não existe na unidade, ou o título não tem correspondência suficiente. Nesses casos o log passa a registrar o motivo da decisão (`om_not_found`, `title_no_match`, `grupo_sem_atividade`) para auditoria na tela de logs.

### 5. Normalização retroativa
Padronizar os 31 RDOs da OM `24030` para um único formato de número, unindo os dois cards em um.

## Detalhes técnicos

- Extrair a lógica de chave/similaridade para uso comum: `supabase/functions/_shared/rdoParser.ts` (`omKey`, `routeProject`, `significantTokens`) passa a seguir as mesmas regras de `src/lib/rdoActivityGroups.ts` (`normalizeOmKeyNumber`, `omTitleTokens`, `tokenSimilarity`, limiar 0.8).
- `routeProject` ganha entrada adicional: títulos de OM já usados nos relatórios da unidade (`reports.maintenance_order_title`), além do nome do projeto.
- `uazapi-webhook/index.ts`: ao gravar o relatório, usar o número de OM canônico da unidade; registrar o motivo do roteamento no log.
- Migração de dados via SQL para o caso `24030`.

## Verificação

- Enviar no grupo de teste duas mensagens com o mesmo serviço e títulos ligeiramente diferentes → devem cair no mesmo card.
- Enviar uma com OM nova → deve criar card novo.
- Conferir em "Meus RDOs" que a OM 24030 aparece como um único card.
