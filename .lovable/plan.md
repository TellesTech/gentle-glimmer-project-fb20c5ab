# Fazer o PDF do RDO CAC refletir exatamente o sistema

## Diagnóstico confirmado

- O RDO CAC de 21/09 é o RDO 026 e possui 10 fotos vinculadas no sistema.
- O PDF assinado guardado foi criado em 23/09 às 09:16 (horário de Brasília).
- As 10 fotos foram vinculadas ao RDO depois, às 10:22.
- O download comum prioriza o PDF guardado e só verifica se houve assinatura mais recente. Alterações posteriores nas fotos não invalidam essa cópia.
- A página interna do RDO ainda usa um segundo caminho próprio de geração, diferente dos cards e do portal.

## Correção

1. Antes de reutilizar um PDF guardado, comparar sua data com a última alteração de tudo que aparece no relatório, incluindo fotos, atividades, desvios, presença e assinaturas.
2. Se qualquer conteúdo estiver mais novo, gerar o PDF novamente com os dados atuais em vez de entregar a cópia antiga.
3. Tornar a consulta atual do sistema a fonte única das fotos e validar a quantidade: se o RDO mostra 10 fotos, o PDF só será concluído depois de carregar as 10.
4. Se uma foto atual falhar no carregamento, repetir com link temporário. Se ainda falhar, informar o erro e não entregar silenciosamente um PDF incompleto.
5. Manter o aviso de indisponibilidade apenas para fotos antigas cujo arquivo realmente não existe mais.
6. Substituir o caminho próprio da página do RDO pelo mesmo download usado nos cards, portal e arquivos em lote, garantindo o mesmo resultado em todos os lugares.

## Verificação

- Baixar o RDO CAC 026 de 21/09 pelo card e pela página do RDO.
- Confirmar que o PDF contém exatamente as 10 fotos exibidas no sistema.
- Conferir o download pelo portal de assinatura e dentro do arquivo em lote.
- Validar um RDO assinado sem mudanças posteriores, para garantir que o PDF guardado continue sendo usado quando estiver atualizado.
- Validar um RDO antigo com arquivo perdido, mantendo o aviso correto sem bloquear os demais documentos.

## Detalhes técnicos

- Centralizar os downloads em `getReportPdfBlob`.
- Calcular a atualização efetiva pelo maior `created_at`/`updated_at` dos dados-base e coleções filhas; não depender somente de `reports.updated_at` ou da última assinatura.
- Fazer o carregador de imagens devolver a contagem de sucesso e aplicar modo estrito às fotos atuais antes de salvar o arquivo.
