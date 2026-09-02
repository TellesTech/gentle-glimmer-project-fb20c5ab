# Fotos do RDO Suzano de 28/08 não salvaram — diagnóstico e correção

## O que os dados mostram (verificado agora no banco)

- Hoje às **12:48** foram enviadas **8 fotos** e às **12:53** mais **3 fotos** para o armazenamento (bucket de fotos). Nenhuma dessas 11 imagens tem registro na tabela de fotos de RDO — ou seja, subiram para o servidor, mas nunca foram vinculadas a nenhum RDO.
- Os dois RDOs Suzano de **28/08** (RDO-037 e RDO-016) estão com **0 fotos** e continuam com situação "enviado".
- Isso é a pista principal: quando o formulário de edição salva, ele **rebaixa** a situação do RDO para "concluído". Como os dois seguem "enviado", o salvamento da edição **não chegou a rodar** — as fotos ficaram só na tela e se perderam ao sair.
- Prova de que o caminho funciona quando o salvamento acontece: às 13:53 uma foto foi gravada normalmente em outro RDO de 28/08.

Causa provável (a confirmar na primeira etapa): as fotos só são gravadas no clique de "Salvar". Se o usuário sai, troca de aba, o RDO já está enviado/assinado ou o salvamento falha em qualquer etapa anterior (efetivo, desvios, atrasos), as fotos somem sem aviso.

## Correções propostas

### 1. Gravar a foto no momento do upload (edição de RDO existente)
Ao editar um RDO que já existe, cada foto enviada é vinculada ao RDO imediatamente, sem depender do botão Salvar. Remover uma foto também apaga o vínculo na hora. Assim, sair da tela nunca mais perde fotos.

### 2. Aviso de saída com fotos não salvas (RDO novo)
Em RDO ainda não criado, manter o envio no salvamento, mas bloquear a saída da tela com aviso claro de "há fotos não salvas".

### 3. Não rebaixar a situação do RDO ao editar
Editar um RDO "enviado"/"assinado" não deve voltar para "concluído". Preservar a situação atual quando ela for mais avançada.

### 4. Erro visível em vez de falha silenciosa
Qualquer falha ao gravar foto mostra mensagem específica ("Não foi possível salvar as fotos: ...") e registra no log de erros do app, para diagnóstico futuro.

### 5. Corrigir capa das pastas no portal do cliente
A consulta de foto de capa no painel do cliente busca uma coluna que não existe (`photo_url` em vez de `url`), então nenhuma capa aparece. Corrigir o nome da coluna.

### 6. Recuperar as 11 fotos órfãs de hoje
Os arquivos ainda estão no armazenamento. Após a correção, vinculo essas 11 imagens ao(s) RDO(s) corretos — preciso que você confirme a qual RDO de 28/08 pertencem (RDO-037 ou RDO-016, ou divididas).

## Verificação

- Editar um RDO de 28/08, adicionar fotos, sair sem salvar e reabrir: fotos devem estar lá.
- Editar RDO já enviado: fotos salvam e a situação continua "enviado".
- Conferir no banco a contagem de fotos por RDO antes/depois.

## Detalhes técnicos

- `SimplifiedReportForm.tsx` / `QuickReportFormContent.tsx`: em modo edição, callback de fotos passa a fazer insert/delete direto em `report_photos` (com `reportId` conhecido) e invalidar as queries do relatório; o diff no submit continua como rede de segurança.
- `ReportForm.tsx`: mesmo tratamento no passo de fotos.
- `updateReportMutation`: parar de forçar `status: 'completed'`; manter `sent`/`signed`/`finalized` quando já for o caso.
- `ClientDashboard.tsx` (query `client-activity-cover-photos`): trocar `photo_url` por `url`.
- Guard de saída (`beforeunload` + diálogo já existente de abas) considerando fotos pendentes.
