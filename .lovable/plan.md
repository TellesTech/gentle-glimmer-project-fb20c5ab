## Resposta curta

Sim, dá pra enviar por pasta — e nesse seu caso (backup de ~900 MB já descompactado em `data/`, `files/`, `RDOs/` + `manifest.json`) é o **melhor caminho**, porque:

- Evita gerar/enviar um ZIP gigante de novo
- Cada arquivo é enviado individualmente direto do navegador para o destino
- Funciona mesmo se algum arquivo individual falhar (continua os demais)

## Plano: adicionar opção "Importar pasta de backup"

1. **Nova opção na aba Importar** (`AdminBackup.tsx`)
   - Manter o upload de `.zip` atual.
   - Adicionar um segundo botão: **"Importar pasta de backup"**, usando `<input type="file" webkitdirectory directory multiple>` para selecionar a pasta inteira.
   - Aceitar a estrutura exata da imagem: `manifest.json`, `data/*.json`, `files/<bucket>/...`, `RDOs/...`, opcional `RDOs_Assinados/...`.

2. **Validação da pasta**
   - Procurar `manifest.json` no nível raiz; se não existir, mostrar erro claro.
   - Listar quantos arquivos por categoria (dados, mídia, PDFs) antes de começar, para o usuário confirmar.

3. **Restauração por partes (mesma lógica já implementada para ZIP)**
   - **Dados**: ler cada `data/*.json`, dividir em lotes de 200 registros e enviar à edge function `restore-backup` com `action: 'batch'`.
   - **Mídia**: para cada arquivo em `files/<bucket>/...`, fazer upload direto ao bucket correspondente (`report-photos`, `company-photos`, `site-photos`, `project-photos`, `avatars`, etc.) via `supabase.storage.upload` no navegador.
   - **PDFs**: arquivos em `RDOs/...` e `RDOs_Assinados/...` vão para o bucket `report-pdfs` mantendo o caminho relativo.

4. **Progresso e resiliência**
   - Mostrar progresso por fase (dados → mídia → PDFs) e quantidade de arquivos processados.
   - Logar erros individuais no console e exibir resumo final no toast (`X registros, Y mídias, Z PDFs, N falhas`).
   - Botão para cancelar a importação no meio do processo.

5. **Sem mudanças no banco**
   - A edge function `restore-backup` já aceita `action: 'batch'` da última correção, então não precisa nova migration.
   - Reaproveita as políticas de storage existentes nos buckets de destino.

## Por que isso é melhor que recompactar em ZIP

- ZIP de 900 MB no navegador consome muita memória e cai facilmente.
- Upload direto por arquivo respeita o limite de tamanho do Storage (≈ 50 MB por arquivo individual, suficiente para fotos e PDFs).
- Se cair a conexão, dá pra reiniciar do ponto onde parou (futuro), porque cada arquivo é independente.

Se aprovar, eu implemento essa opção de "Importar pasta" na aba Importar mantendo a opção de ZIP como alternativa.