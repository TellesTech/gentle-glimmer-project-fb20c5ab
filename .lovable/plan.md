# Impedir o sumiço das fotos dos RDOs

## Diagnóstico confirmado
- Há RDOs recentes do Ricardo que foram criados e depois atualizados, mas hoje estão com zero fotos vinculadas, enquanto outros do mesmo período mantêm as imagens.
- A edição do RDO sincroniza fotos duas vezes: imediatamente ao alterar a tela e novamente ao salvar.
- As duas rotinas atuais interpretam qualquer foto ausente da lista da tela como exclusão e apagam o vínculo no banco.
- Ao clicar para remover uma foto, o arquivo também é apagado do armazenamento antes da confirmação final. Isso torna uma falha de estado ou conexão potencialmente irreversível.

## Correção
1. Remover a sincronização concorrente e manter uma única fonte de gravação das fotos.
2. Nunca apagar fotos automaticamente quando a lista estiver vazia por falha de carregamento; exclusões acontecerão somente por uma ação explícita do usuário e com confirmação.
3. Separar “adicionar foto” de “remover foto”, usando o identificador do registro em vez de comparar apenas endereços.
4. Não apagar imediatamente o arquivo físico ao retirar uma foto da tela; primeiro confirmar a atualização do RDO e preservar segurança contra perda acidental.
5. Exibir erro claro e manter a lista anterior quando a gravação falhar, em vez de deixar a tela aparentar sucesso.

## Recuperação e validação
- Procurar arquivos recentes que ainda existam no armazenamento, mas perderam o vínculo com os RDOs, e religá-los quando a origem puder ser identificada com segurança.
- Comparar os RDOs recentes do Ricardo antes e depois da correção.
- Testar: abrir e salvar sem mexer nas fotos, adicionar várias fotos, remover uma foto, conexão lenta e dois cliques rápidos.
- Confirmar que as fotos continuam visíveis no RDO e no PDF após fechar e abrir novamente.

## Limite conhecido
Fotos antigas do sistema anterior cujo arquivo já não existe não podem ser reconstruídas automaticamente; elas continuarão identificadas como indisponíveis.
