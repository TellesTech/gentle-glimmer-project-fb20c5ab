## Problema

No card "Importar Backup por Arquivos Avulsos", após selecionar os arquivos, não há nenhuma análise/prévia — o sistema só pede para clicar em "Iniciar Restauração". No print, foi selecionado apenas 1 arquivo (provavelmente `manifest.json`) e nenhum JSON de tabela, então a restauração não importa nada e o usuário não tem feedback do que será feito.

Além disso há um bug menor: o texto diz "1 arquivos selecionados" (plural errado) e "0.00 MB" quando o arquivo é muito pequeno.

## Solução: adicionar prévia antes de confirmar

Tudo dentro de `src/pages/AdminBackup.tsx`, sem mudar backend/edge function.

### 1. Ao selecionar arquivos, ler e analisar imediatamente

No `handleLooseFilesSelect`:
- Validar que `manifest.json` está presente (já existe).
- Ler `manifest.json` (`await file.text()` + `JSON.parse`) e guardar em novo estado `looseManifest`.
- Para cada chave em `manifest.tables` (ou no `TABLE_ORDER`), verificar se existe `<tabela>.json` na seleção. Montar estado `looseAnalysis` com:
  - Data/hora do backup (`manifest.exportedAt` / `manifest.createdAt`)
  - Versão / origem (se houver no manifest)
  - Lista de tabelas: nome, registros esperados (do manifest), JSON presente sim/não, tamanho do arquivo
  - Lista de arquivos de mídia presentes (jpg/png/webp/pdf), contagem
  - Lista de arquivos ignorados (que não batem com nenhuma tabela conhecida nem são mídia)

### 2. Renderizar painel de prévia no card

Logo abaixo do dropzone, quando `looseManifest` estiver populado:
- Resumo: "Backup de DD/MM/AAAA HH:MM • N tabelas no manifest • X arquivos JSON encontrados • Y mídias"
- Tabela compacta (Table do shadcn): coluna Tabela | Registros (manifest) | Arquivo encontrado (✓/—) | Tamanho
  - Linhas com arquivo ausente em destaque (text-muted-foreground ou ícone de aviso)
- Bloco de alertas:
  - Se nenhum `<tabela>.json` for encontrado → alerta destrutivo "Nenhuma tabela será restaurada — você selecionou apenas o manifest.json. Selecione também os arquivos JSON da pasta `data/`."
  - Se faltarem tabelas que o manifest declarou → alerta amarelo listando até 5 nomes
  - Se houver arquivos ignorados → alerta informativo
- Botão "Iniciar Restauração dos Arquivos" fica **desabilitado** quando não houver nenhum JSON de tabela presente.

### 3. Correções de UI

- Pluralizar: `${n} arquivo${n === 1 ? '' : 's'} selecionado${n === 1 ? '' : 's'}`
- Mostrar tamanho em KB quando < 1 MB: `size < 1MB ? `${(size/1024).toFixed(1)} KB` : `${(size/1024/1024).toFixed(2)} MB``
- Adicionar botão "Limpar seleção" ao lado do botão de restaurar.

### 4. Reset

Ao concluir (sucesso ou erro), limpar também `looseManifest` e `looseAnalysis` junto com `selectedLooseFiles`.

## Detalhes técnicos

- Novos estados: `looseManifest: any | null`, `looseAnalysis: { tables: Array<{name:string; expected:number; present:boolean; size:number}>; mediaCount:number; ignored:string[] } | null`.
- Mídias são contadas mas **não** enviadas (a edge function `restore-backup` no modo `action: 'batch'` só lida com registros; uploads de mídia avulsa ficam fora do escopo, como já estava no plano original).
- Sem mudanças em migrations, edge functions ou outros arquivos.

## Fora do escopo

- Upload de mídias avulsas para os buckets.
- Mudanças nos fluxos de ZIP e Pasta.
- Salvar/cachear o manifest entre sessões.
