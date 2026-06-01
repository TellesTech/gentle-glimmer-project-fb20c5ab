## Problema identificado

O erro atual não está mais no Base64 nem no `restore-backup`: ele acontece antes, no upload do ZIP para o Supabase Storage.

O arquivo selecionado tem cerca de **690 MB**, e o Supabase Storage está recusando o upload direto pelo navegador com:

```text
413 Payload too large
The object exceeded the maximum allowed size
```

Pelos arquivos enviados, o backup completo contém:
- 14.966 registros em JSON
- 1.026 arquivos de mídia
- 918 PDFs de RDO
- cerca de 903,9 MB no relatório original

Ou seja, tentar importar tudo como um ZIP único pelo upload padrão do Storage não é viável nesse fluxo.

## Plano de correção

1. **Parar de enviar o ZIP inteiro para o Storage antes da restauração**
   - Remover o passo atual que faz `supabase.storage.from('temp-backups').upload(...)` com o ZIP completo.
   - Isso elimina o erro `Payload too large` no upload do arquivo de 690 MB.

2. **Processar o ZIP no navegador e importar por partes**
   - Abrir o ZIP localmente com `JSZip`, como a tela já faz para ler o `manifest.json`.
   - Para a fase de dados, ler os arquivos `data/*.json` no navegador e enviar lotes pequenos para a Edge Function.
   - Cada chamada enviará somente uma tabela e um lote limitado de registros, evitando limite de payload.

3. **Criar modo de importação por lote na Edge Function**
   - Adicionar suporte a uma ação como `action: "import-table-batch"` em `restore-backup`.
   - A função validará permissão do usuário e fará `upsert` apenas do lote recebido.
   - Manter o modo antigo por `storagePath`/`fileContent` como fallback, mas o frontend passará a usar o modo por lotes para backups grandes.

4. **Importar arquivos de mídia e PDFs em partes pequenas**
   - Em vez de subir o ZIP completo, extrair cada arquivo do ZIP no navegador e subir individualmente ao bucket correto.
   - Corrigir a lista de buckets para bater com o backup real: `report-photos`, `company-photos`, `site-photos`, `project-photos`, `avatars`.
   - Para `RDOs/`, criar/restaurar destino apropriado em Storage, provavelmente `report-pdfs`, respeitando o caminho interno do ZIP.

5. **Melhorar feedback e resiliência**
   - Mostrar progresso por fase: dados, mídias e PDFs.
   - Se um arquivo individual falhar, registrar o erro e continuar quando possível.
   - Ao final, exibir quantos registros, mídias e PDFs foram importados, e listar falhas parciais.

6. **Ajuste de banco/storage se necessário**
   - Verificar/criar buckets ausentes usados pelo backup, como `report-photos`, `company-photos`, `site-photos`, `project-photos` e `report-pdfs`.
   - Criar políticas RLS adequadas para admins/directors/super_admins quando algum bucket ainda não existir.

## Resultado esperado

A importação deixará de depender de um upload único de centenas de MB e passará a restaurar o backup completo de forma fracionada, compatível com backups grandes como o arquivo enviado.