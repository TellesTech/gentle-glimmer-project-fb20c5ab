# Garantir assinatura completa no sistema e no PDF

## Objetivo
Eliminar cortes e reduzir a assinatura de forma proporcional somente quando necessário, preservando integralmente traços, letras iniciais/finais e nomes longos em todas as telas e no PDF.

## Implementação

1. **Padronizar a imagem antes da exibição**
   - Criar um utilitário compartilhado que carregue a assinatura, detecte sua área visível e gere uma versão normalizada com margem de segurança nos quatro lados.
   - Manter a proporção original, sem esticar ou usar recorte (`cover`).
   - Aplicar a mesma normalização a assinaturas digitadas, enviadas por imagem e já armazenadas.

2. **Corrigir todas as visualizações no sistema**
   - Ajustar o componente compartilhado de assinatura para sempre usar `object-contain`, largura e altura máximas seguras e área interna com folga.
   - Substituir as prévias diretas ainda existentes pelo componente compartilhado, inclusive em Configurações e no envio para assinatura.
   - Remover o recorte causado pelos contêineres com `overflow-hidden` nas telas de detalhes do RDO e linha do tempo.
   - Aumentar a área útil da prévia quando necessário para que nomes longos continuem legíveis sem encostar nas bordas.

3. **Corrigir a renderização no PDF**
   - Normalizar a assinatura antes de enviá-la ao jsPDF.
   - Calcular o encaixe proporcional dentro de uma caixa com margem interna fixa, usando a área real da assinatura em vez de depender apenas do tamanho total do arquivo.
   - Manter as duas assinaturas completas, uma por bloco, com borda verde quando assinadas e sem interferir no nome, função, data e origem.

4. **Compatibilidade com assinaturas existentes**
   - Reprocessar visualmente as imagens antigas no momento da exibição e da geração do PDF, sem alterar os registros salvos.
   - Quando o arquivo original já tiver pixels definitivamente cortados, preservar tudo o que ainda existe; somente uma nova captura consegue recuperar um traço que não foi armazenado.

## Validação
- Testar assinatura digitada com nome curto e com nomes longos, incluindo “Ricardo Gabriel Barcell”.
- Conferir Configurações, perfil do cliente, aprovação rápida, histórico/linha do tempo, detalhe do RDO e diálogo de envio.
- Gerar PDF com assinatura WEES e cliente e verificar visualmente: nenhum traço tocando as bordas, nenhuma distorção, ambas completas e bordas verdes.
- Validar em desktop e mobile.

## Detalhes técnicos
- Centralizar normalização e cálculo de encaixe para evitar regras diferentes entre React e jsPDF.
- Preservar suporte a `data:`, `blob:` e URLs já tratado pelo componente atual.
- Não alterar fluxo de assinatura, banco de dados ou regras de aprovação; a mudança será somente na preparação e apresentação da imagem.