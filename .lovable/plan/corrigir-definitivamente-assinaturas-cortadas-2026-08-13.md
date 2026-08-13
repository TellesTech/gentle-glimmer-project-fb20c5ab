# Corrigir definitivamente assinaturas cortadas

## Diagnóstico confirmado

- A assinatura de **Ricardo Gabriel Barcelos** salva em `profiles.signature_data` é um PNG legado de **400×120 px** e já contém o nome cortado dentro do próprio arquivo.
- As assinaturas históricas dele em `report_signatures` reutilizam exatamente esse mesmo arquivo; por isso o corte aparece tanto no sistema quanto nos PDFs.
- A normalização visual atual apenas adiciona margens ao conteúdo existente. Ela não consegue recuperar “os”, pois essas letras não estão no bitmap armazenado.

## Implementação

### 1. Gerador único de assinatura por nome
- Extrair a geração tipográfica para um utilitário compartilhado, carregando a fonte antes de desenhar.
- Medir a área real pintada, renderizar em alta resolução e validar margens mínimas nos quatro lados.
- Usar o mesmo gerador no cadastro, na prévia, na exibição e no PDF.

### 2. Compatibilidade com assinaturas antigas
- Identificar assinaturas tipográficas legadas no formato 400×120.
- Quando houver nome do assinante, regenerar a imagem completa pelo nome antes de exibi-la ou inseri-la no PDF.
- Manter assinaturas desenhadas ou enviadas por imagem sem alteração, para não substituir a escrita real do usuário.

### 3. Reparar os dados já gravados
- Regenerar a assinatura completa de Ricardo Gabriel Barcelos em alta resolução.
- Atualizar a assinatura do perfil e todas as cópias históricas correspondentes em `report_signatures`, preservando IDs, datas, autoria e demais dados dos RDOs.
- Aplicar a substituição somente aos registros que tenham o bitmap legado confirmado, sem modificar assinaturas diferentes.

### 4. Padronizar todas as telas e PDFs
- Passar o nome do assinante ao componente compartilhado em perfil, configurações, histórico, aprovação e detalhes do RDO.
- Garantir proporção estável, margem interna e ausência de recorte em desktop e celular.
- No PDF, encaixar a imagem normalizada pela área útil e manter margem segura dentro da borda verde.

## Validação

- Comparar os pixels extremos da nova imagem para confirmar margem livre em todos os lados.
- Verificar visualmente “Ricardo Gabriel Barcelos” completo em configurações, perfil do cliente e assinatura do RDO.
- Gerar e inspecionar um PDF com assinaturas WEES e cliente, confirmando nomes completos, imagens sem corte e bordas verdes.
- Testar um nome ainda maior e uma assinatura enviada por imagem para evitar regressões.