
# Painel de Propriedades redimensionável (arrastar para a esquerda)

## Diagnóstico

Hoje o painel direito (`PropertiesPanel`) tem largura fixa `w-64` (256 px) em `src/components/service-reports/PropertiesPanel.tsx:496`. Não há handle de drag. Por isso o usuário não consegue "puxar mais pro lado" para ver legendas/títulos compridos.

## Solução

Tornar a largura do painel ajustável pelo usuário via drag na borda esquerda.

### Mudanças

**`src/components/service-reports/PropertiesPanel.tsx`**
- Substituir `w-64` por largura controlada via state (px), com padrão 256 px e limites 240–560 px.
- Persistir o valor escolhido em `localStorage` (`service-report:properties-width`) para não resetar a cada navegação.
- Adicionar um **handle vertical de 4 px** na borda esquerda do painel (`absolute inset-y-0 -left-0.5 w-1 cursor-col-resize hover:bg-primary/40`).
- Lógica: `onMouseDown` registra `startX` e `startW`; `mousemove` calcula `newW = clamp(startW + (startX - clientX), 240, 560)`; `mouseup` solta listeners.
- Manter `shrink-0` para não ser comprimido pelo flex pai.

### Fora do escopo

- Não mexer no painel esquerdo nem na área central de preview.
- Não alterar comportamento do `PdfPagePreview`, geração de PDF, ou layout do `ServiceReportEditor` em si.
- Sem responsividade automática para mobile — o editor já é desktop-only.

## Validação

1. Abrir o editor → arrastar a borda esquerda do painel → largura aumenta/diminui suavemente.
2. Recarregar a página → largura escolhida é mantida.
3. Tentar arrastar além dos limites → trava em 240 px / 560 px.
4. Conteúdo do painel (campos, fotos) acompanha a nova largura sem quebrar.
