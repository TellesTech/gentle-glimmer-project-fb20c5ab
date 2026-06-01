## Objetivo

Permitir restaurar backup selecionando **arquivos avulsos** (sem precisar de ZIP nem de pasta única com `webkitdirectory`), incluindo casos em que o usuário envia apenas `manifest.json` + JSONs da pasta `data/` (e opcionalmente mídias).

## Mudanças em `src/pages/AdminBackup.tsx`

1. **Novo card "Importar Backup por Arquivos Avulsos"** abaixo dos dois cards existentes (ZIP e Pasta), na mesma aba de restauração.

2. **Novo input file** com `multiple` (sem `webkitdirectory`) que aceita qualquer combinação de:
   - `manifest.json` (obrigatório — pode estar em qualquer lugar da seleção, identificado pelo nome final)
   - Arquivos `*.json` correspondentes a tabelas (companies.json, reports.json, etc.) — nome do arquivo (sem extensão) é usado como nome da tabela
   - Arquivos de mídia (jpg/png/webp/pdf) — opcionais; quando presentes, o usuário escolhe em qual bucket entrar via prefixo do nome (`report-photos__arquivo.jpg`) **ou** simplesmente ignorados se não houver prefixo reconhecido

3. **Novo handler `handleLooseFilesSelect`**: valida que existe `manifest.json` na seleção; em caso negativo, mostra toast claro ("Inclua o manifest.json na seleção").

4. **Novo handler `handleRestoreLooseFiles`**: reaproveita a lógica de `handleRestoreFolder`, mas indexa arquivos por `file.name` em vez de `webkitRelativePath`:
   - Para cada tabela em `TABLE_ORDER`, procura `${tableName}.json` entre os arquivos selecionados.
   - Faz o mesmo loop de batches chamando a edge function `restore-backup` com `action: 'batch'`.
   - Pula a fase de mídia/PDFs quando nenhum arquivo binário foi enviado.
   - Reaproveita `setProgress`/`setProgressMessage`/toasts existentes.

5. **UX**: dropzone com mesmo estilo dos outros (borda tracejada, ícone, contagem de arquivos selecionados, tamanho total, botão "Iniciar Restauração dos Arquivos").

## Detalhes técnicos

- Sem mudanças no backend nem em migrations.
- Sem alterações na edge function `restore-backup` (continua recebendo `{ action: 'batch', table, records }`).
- Reaproveitar estado novo: `selectedLooseFiles: File[] | null`.
- Reutilizar a mesma constante `TABLE_ORDER` já existente (extrair para fora dos handlers ou duplicar inline — preferir extrair para uma const no topo do arquivo).
- O `relatorio-backup.txt` é ignorado se vier junto (não é necessário para restauração).

## Fora do escopo

- Não muda os fluxos atuais de ZIP e Pasta.
- Não adiciona prévia/inspeção do manifest (pode virar follow-up).
- Não trata upload de mídias avulsas em buckets (a menos que prefixo do nome do arquivo identifique o bucket; caso contrário, mídias são ignoradas com aviso no toast final).
