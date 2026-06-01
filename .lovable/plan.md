## Diagnóstico

A importação está falhando porque o frontend envia o arquivo ZIP como Base64 no campo `fileContent`, mas em algumas execuções esse campo chega ausente ou inválido na Edge Function. O log atual confirma isso: a requisição para `restore-backup` foi enviada com apenas `{"mode":"full","phase":"data"}`, e a função tentou executar `atob(fileContent)`, gerando `Failed to decode base64` e retornando 400.

## Plano de correção

1. **Corrigir o envio do ZIP no frontend**
   - Garantir que `AdminBackup.tsx` só chame `restore-backup` depois de converter o arquivo selecionado para Base64 válido.
   - Validar explicitamente se o conteúdo Base64 foi gerado antes de invocar a função.
   - Enviar `fileContent` em todas as chamadas, incluindo a fase de dados e cada bucket de arquivos.

2. **Fortalecer a Edge Function `restore-backup`**
   - Validar o corpo da requisição antes de tentar decodificar o ZIP.
   - Retornar erro claro quando `fileContent` estiver ausente, vazio ou malformado, em vez de quebrar com erro genérico.
   - Aceitar tanto Base64 puro quanto Data URL (`data:application/zip;base64,...`) para evitar incompatibilidade entre navegadores/implementações.

3. **Melhorar o feedback visual da importação**
   - Exibir no toast a mensagem real retornada pela Edge Function, não apenas “non-2xx status code”.
   - Manter a tela sem “blank screen” quando a restauração falhar.
   - Ajustar o progresso para indicar em qual fase a falha ocorreu.

4. **Verificação**
   - Revisar os pontos de chamada para confirmar que o payload contém `fileContent`.
   - Reimplantar a Edge Function `restore-backup`.
   - Conferir logs/requisição para validar que o erro de Base64 não ocorre mais.