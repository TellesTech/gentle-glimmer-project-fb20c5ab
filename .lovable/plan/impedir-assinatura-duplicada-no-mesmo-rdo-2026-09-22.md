# Impedir assinatura duplicada no mesmo RDO

## Resultado esperado
Cada pessoa poderá ter somente uma assinatura por RDO, independentemente de clicar novamente, atualizar a página ou usar outro fluxo de assinatura.

## Implementação
1. **Corrigir o registro da Laura**
   - No RDO confirmado, manter a assinatura mais recente da Laura e remover apenas as duas assinaturas anteriores.
   - Preservar as demais assinaturas e o vínculo do RDO.

2. **Bloquear duplicidade no banco**
   - Criar restrições de unicidade por RDO e identidade do signatário: usuário autenticado, e-mail identificado ou acesso individual.
   - Aplicar a proteção após a limpeza dos registros repetidos, garantindo que duas solicitações simultâneas também não criem duplicidade.

3. **Unificar o fluxo de assinatura**
   - Fazer a aprovação no portal usar o serviço seguro de assinatura, que identifica a pessoa e já verifica se ela assinou o RDO.
   - Manter os demais fluxos compatíveis e tratar a resposta de duplicidade como “Este RDO já foi assinado por você”.

4. **Bloquear repetição na tela**
   - Após a primeira assinatura, atualizar imediatamente o estado do RDO e retirar/desabilitar a ação de assinar novamente.
   - Exibir uma mensagem clara caso uma segunda tentativa chegue ao servidor.

5. **Validar**
   - Confirmar que o RDO da Laura fica com apenas a assinatura mais recente.
   - Testar assinatura individual, assinatura em lote e envio para assinatura.
   - Confirmar que pessoas diferentes ainda podem assinar o mesmo RDO normalmente.

## Detalhes técnicos
- Hoje existem três assinaturas da Laura no RDO `eb5f064a-22e9-4cb7-845a-5389bbbf3024`, todas ligadas ao mesmo usuário.
- O serviço `submit-signature` já consulta duplicidade, mas a tela do portal grava diretamente em `report_signatures`, contornando essa verificação.
- A tabela possui apenas chave única no identificador da linha; será adicionada proteção por identidade do signatário para eliminar também condições de corrida.
- Assinaturas antigas sem usuário, e-mail ou acesso identificável não serão removidas automaticamente, evitando apagar registros legítimos de pessoas diferentes.
