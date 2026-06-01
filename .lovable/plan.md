## Diagnóstico encontrado

O problema principal não parece ser “o arquivo não foi aceito”, e sim o fluxo de importação estar frágil e silencioso:

- O usuário selecionou uma imagem `.jpg` no modo de pasta e recebeu erro de `manifest.json`, porque esse modo exige a pasta raiz inteira do backup, não arquivos soltos.
- O modo “Arquivos Avulsos” só aceita `.json`, mas hoje procura os arquivos pelo nome simples (`companies.json`). Se os arquivos vierem da pasta original (`data/companies.json`) ou forem selecionados de forma diferente, a análise/importação pode não encontrar nada.
- O `manifest.json` gerado pelo backup usa `tables: string[]` e `recordCounts`, mas a prévia atual interpreta `manifest.tables` como mapa de contagens; por isso pode mostrar `0` registros esperados mesmo quando o backup tem dados.
- A função `restore-backup` faz `upsert(..., { onConflict: 'id' })` para todas as tabelas, mas algumas tabelas podem não ter chave primária detectável/compatível, e várias tabelas listadas no código nem existem no banco atual (`client_wallet`, `reward_redemptions`, `backup_history`, etc.). Isso pode gerar erros por tabela.
- O fluxo mostra “Backup restaurado!” mesmo quando houve erros em tabelas; o usuário fica sem saber que nada útil foi importado.
- A restauração de mídias/PDFs tenta usar buckets que não existem no projeto atual (`report-photos`, `company-photos`, `project-photos`, `report-pdfs`, etc.). Hoje só existem `avatars`, `service-report-photos` e `temp-backups`, então parte da restauração sempre falha.
- O botão “Substituir” existe, mas o modo `replace` não é realmente enviado/aplicado no backend; isso é perigoso e confuso.

## Plano de correção

### 1. Corrigir análise dos arquivos avulsos

No `src/pages/AdminBackup.tsx`:

- Ler `manifest.recordCounts` corretamente.
- Aceitar tanto arquivos soltos (`companies.json`) quanto caminhos preservados (`data/companies.json`) quando disponível via `webkitRelativePath`.
- Mostrar contagem real esperada por tabela.
- Detectar e informar quando o usuário selecionou só imagens/PDFs sem os JSONs de dados.
- Ajustar o texto para deixar claro:
  - `.zip` = backup completo;
  - pasta = pasta raiz descompactada;
  - arquivos avulsos = `manifest.json` + JSONs da pasta `data/`.

### 2. Transformar a restauração em diagnóstico confiável

Ainda em `AdminBackup.tsx`:

- Trocar o toast genérico por um resultado claro:
  - tabelas importadas;
  - registros importados;
  - tabelas com erro;
  - arquivos ignorados;
  - mídias/PDFs falhos por bucket ausente.
- Se `totalRecords === 0` e existirem erros, mostrar “Nenhum dado foi importado” em vez de “Backup restaurado”.
- Exibir uma lista resumida dos primeiros erros na própria tela, sem depender do console.
- Desabilitar ou renomear visualmente o modo `replace`, já que ele não está implementado de verdade, para evitar expectativa errada.

### 3. Corrigir a função `restore-backup`

No `supabase/functions/restore-backup/index.ts`:

- Validar que a tabela recebida no modo `batch` está na lista permitida e existe no banco.
- Retornar resposta estruturada por lote:
  - `success`;
  - `recordsImported`;
  - `table`;
  - `error`;
  - `hint` quando for erro esperado.
- Melhorar mensagens de erro de banco para aparecerem corretamente no frontend.
- Evitar que um erro em uma tabela pare toda a importação, mas marcar claramente que a restauração foi parcial.

### 4. Corrigir buckets de mídia/PDF

Como o projeto só tem estes buckets hoje:

- `avatars`
- `service-report-photos`
- `temp-backups`

A correção será:

- No frontend, detectar mídias/PDFs de buckets inexistentes e mostrar como “não restaurados: bucket ausente”.
- Não tentar fazer upload para buckets inexistentes sem avisar.
- Se for necessário restaurar fotos de relatórios, logos e PDFs completos, criarei uma migração separada para criar/configurar os buckets ausentes e políticas de storage. Essa parte precisa de aprovação porque altera Supabase Storage.

### 5. Testar com sinais reais

Após implementar:

- Validar chamadas recentes da Edge Function `restore-backup` nos logs.
- Usar um teste controlado de chamada à função para confirmar que erros agora voltam legíveis.
- Garantir que a UI não mostre mais sucesso falso quando nenhuma tabela for importada.

## Arquivos afetados

- `src/pages/AdminBackup.tsx`
- `supabase/functions/restore-backup/index.ts`

## Observação importante

A correção inicial será focada em fazer a importação de dados JSON funcionar e diagnosticar corretamente. Restauração completa de fotos/PDFs depende dos buckets ausentes no Supabase; isso pode exigir uma etapa extra de configuração de Storage.