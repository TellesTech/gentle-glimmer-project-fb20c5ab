# Deixar o botão de download visível nos cards de RDO

## O que foi verificado

- Nas pastas de atividade (a tela onde você está agora), o menu de três pontinhos do RDO já existe e traz "Baixar PDF" e "Baixar em branco para assinar". Ele é um ícone cinza claro, sem fundo, colado no canto superior direito do card — fica quase invisível e só se destaca no hover.
- Na lista de RDOs da tela Relatórios (a visão em cards fora das pastas) existe outro menu, mas ele só aparece para super admin e tem apenas "Editar" e "Apagar" — nenhuma opção de download.

## Plano

1. **Tornar o botão evidente na pasta de atividade**
   - Trocar o ícone cinza por um botão com fundo e contorno, sempre visível (não só no hover), com dica "Baixar / opções do RDO".
   - Reposicionar para não brigar com as etiquetas de status do card.

2. **Adicionar os downloads na lista de Relatórios**
   - Incluir "Baixar PDF" e "Baixar em branco para assinar" no menu do card da lista, disponíveis para qualquer usuário que enxerga o RDO (não só super admin), mantendo "Editar" e "Apagar" restritos ao super admin.
   - Mesmo comportamento do menu da pasta: indicador de carregamento enquanto o PDF é gerado e nome de arquivo com o sufixo "-em-branco" quando for a versão sem assinaturas.

3. **Publicar**
   - Como você costuma usar o endereço publicado, publicar ao final para as opções aparecerem lá também.

## Detalhes técnicos

- `src/components/reports/DocumentCabinet.tsx`: no `CardActions` (linhas ~470-518), trocar `variant="ghost"` por um botão com `variant="secondary"`/borda e `title`; ajustar o contêiner `absolute top-2 right-2` do card de RDO (~1461-1472).
- `src/pages/Reports.tsx`: no `ReportCard` (~812-833), mover o `DropdownMenu` para fora do gate `isSuperAdmin`, adicionar os dois itens de download reutilizando `getReportPdfBlob` (`{ pdfOptions: { omitSignatures: true }, forceRegenerate: true }` para a versão em branco) + `triggerDownloadFromBlob`, com estado local de loading; manter Editar/Apagar dentro de `isSuperAdmin`.
- Sem alterações de banco de dados.
