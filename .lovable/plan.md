# Impedir o sumiço das fotos dos RDOs

## Diagnóstico confirmado
- Há RDOs recentes do Ricardo com zero fotos vinculadas, enquanto outros do mesmo período mantêm as imagens.
- Os arquivos de vários desses RDOs ainda existem no armazenamento: por exemplo, oito imagens foram enviadas imediatamente antes da criação do RDO 030 e quatro antes do RDO 028, mas nenhuma foi vinculada ao respectivo RDO. Portanto, parte do “sumiço” é falha ao concluir o vínculo, não perda do arquivo.
- A edição do RDO sincroniza fotos duas vezes: imediatamente ao alterar a tela e novamente ao salvar.
- As duas rotinas atuais interpretam qualquer foto ausente da lista da tela como exclusão e apagam o vínculo no banco.
- Ao clicar para remover uma foto, o arquivo também é apagado do armazenamento antes da confirmação final. Isso torna uma falha de estado ou conexão potencialmente irreversível.

## Correção
1. Remover a sincronização concorrente e manter uma única fonte de gravação das fotos.
2. Fazer o salvamento confirmar que todas as imagens enviadas foram vinculadas ao RDO antes de mostrar sucesso.
3. Nunca apagar fotos automaticamente quando a lista estiver vazia por falha de carregamento; exclusões acontecerão somente por uma ação explícita do usuário e com confirmação.
4. Separar “adicionar foto” de “remover foto”, usando o identificador do registro em vez de comparar apenas endereços.
5. Não apagar imediatamente o arquivo físico ao retirar uma foto da tela; primeiro confirmar a atualização do RDO e preservar segurança contra perda acidental.
6. Exibir erro claro e manter a lista anterior quando a gravação falhar, em vez de deixar a tela aparentar sucesso.

## Recuperação e validação
- Religar aos RDOs as fotos órfãs recentes quando a correspondência por horário e contexto for inequívoca, começando pelos RDOs do Ricardo.
- Comparar os RDOs recentes do Ricardo antes e depois da correção.
- Testar: abrir e salvar sem mexer nas fotos, adicionar várias fotos, remover uma foto, conexão lenta e dois cliques rápidos.
- Confirmar que as fotos continuam visíveis no RDO e no PDF após fechar e abrir novamente.

## Limite conhecido
Fotos antigas do sistema anterior cujo arquivo já não existe não podem ser reconstruídas automaticamente; elas continuarão identificadas como indisponíveis.
