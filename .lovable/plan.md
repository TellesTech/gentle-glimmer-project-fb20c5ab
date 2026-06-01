## Problema
1. Você está em `/super-admin` e não consegue acessar a área de Backup. Hoje o link só existe na sidebar lateral (item "Backup", apenas para `super_admin`) e não há atalho dentro do próprio painel `SuperAdminPanel`. Se a sidebar estiver colapsada ou o item estiver passando despercebido, fica parecendo que a página "não existe".
2. A aba **Importar** já aceita um `.zip`, mas a comunicação está fraca — não fica claro que se trata da restauração completa (dados + fotos + PDFs + assinados) do backup gerado pela aba **Exportar**.

## Plano

### 1. Garantir acesso à área de Backup
- Em `src/pages/SuperAdminPanel.tsx`: adicionar um card/atalho "Backup do Sistema" que leva para `/admin/backup` (mesmo estilo dos demais atalhos do painel, usando o ícone `HardDrive`).
- Em `src/components/layout/Sidebar.tsx`: manter o item Backup também visível para `admin` (hoje só aparece para `super_admin`), alinhando com `MobileSidebar` e com a permissão real da página (`admin` + `super_admin`).
- Conferir que `/admin/backup` continua respondendo para `super_admin` (já está OK em `App.tsx` + `AdminBackup.tsx`).

### 2. Reforçar a opção de importar ZIP completo
Na aba **Importar** de `src/pages/AdminBackup.tsx`:
- Trocar o título para "Importar Backup Completo (.zip)" e a descrição para deixar explícito que aceita o pacote ZIP gerado na aba Exportar, contendo:
  - `data/*.json` (todas as tabelas)
  - `files/<bucket>/...` (fotos e arquivos de mídia)
  - `RDOs/` e `RDOs_Assinados/` (PDFs)
  - `manifest.json`
- Após selecionar o arquivo, abrir o ZIP no cliente (com `JSZip`, já importado) e mostrar um resumo antes de restaurar: nº de tabelas detectadas, total de registros do `manifest.json`, nº de arquivos em `files/` e nº de PDFs. Assim o usuário confirma que o pacote é íntegro.
- Trocar o ícone de upload (hoje usa `Download`) por `Upload`/`CloudUpload` para coerência visual.
- Manter os modos **Mesclar** / **Substituir** já existentes (a função edge `restore-backup` já processa data + files).
- Exibir, no fim, os totais retornados (`recordsImported`, `filesRestored`) num bloco de sucesso.

### 3. Sem mudanças de backend
A função `restore-backup` já lê `data/*.json` e `files/<bucket>/...` do ZIP e restaura tudo via UPSERT + upload no Storage. Nenhuma migration ou alteração de edge function é necessária.

## Arquivos afetados
- `src/pages/SuperAdminPanel.tsx` — novo atalho para Backup.
- `src/components/layout/Sidebar.tsx` — liberar item Backup para `admin`.
- `src/pages/AdminBackup.tsx` — melhorar a aba Importar (textos, ícone, pré-visualização do conteúdo do ZIP, resumo pós-restauração).

Confirma que posso seguir?