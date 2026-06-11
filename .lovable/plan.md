
# Correção: fotos somem do preview do editor, mas aparecem no PDF

## Diagnóstico

O editor (`ServiceReportEditor`) calcula a paginação visual em `paginateAllSections()` dentro de `src/components/service-reports/InteractivePdfPage.tsx`. Já o PDF baixado é gerado por `src/lib/generateServiceReportPdf.ts`, **um caminho de código totalmente diferente**, com sua própria paginação. Por isso o PDF mostra as fotos certinho e o preview na tela não — apenas a paginação visual está com bugs.

### Bugs identificados em `paginateAllSections`

1. **Fotos altas demais somem silenciosamente**
   `addPhotoContinuations` chama `splitPhotos(leftover, effectiveBudget)`. Se a primeira foto restante tem `customHeight` que faz a linha exceder o orçamento da página inteira (`TOTAL_BUDGET = 560`), `splitPhotos` devolve `fit = []` e `rest = leftover`. O `while` entra em `if (fit.length === 0) break;` — e as fotos restantes **nunca são adicionadas a nenhuma página**. Resultado: o usuário vê a seção vazia mesmo com `Fotos (3)` no painel.

2. **Branch da linha 354 também descarta fotos no caso-limite**
   No fluxo onde a seção entra na página atual mas só sobra `photoBudget >= 80`, se a primeira foto não couber, `fit` vem vazio, o slot é empurrado sem fotos, e a continuação cai no mesmo bug (1). Em página fresca o mesmo `splitPhotos` continua retornando vazio.

3. **`estimatePhotoRowH` usa `customHeight ?? 160` cego ao `widthPercent`**
   Quando o usuário redimensiona uma foto para largura grande (>50%), o `customHeight` pode ficar bem alto (cálculo por aspect-ratio no `startResize`, linha ~1342). Isso facilmente passa de 500 px de "linha", quebrando a paginação.

4. **Caption/legenda não soma altura real**
   `estimatePhotoRowH` adiciona apenas `+20` para a legenda, mas o componente real (`InteractivePdfPage`, linha ~1483) pode quebrar em múltiplas linhas. Pequena imprecisão, mas amplifica o bug 1.

## Correções

Tudo isolado em `src/components/service-reports/InteractivePdfPage.tsx`. Sem alterar DB, geração de PDF nem `PhotoBlockEditor`.

### 1. Garantir progresso em `splitPhotos`

Quando o orçamento permite pelo menos uma linha mínima de foto (≥ 60 px) e a primeira foto não cabe pelo seu `customHeight`, **encaixar mesmo assim** apontando que aquela linha consome todo o orçamento restante. Isso evita o "vazamento" sem alterar a foto em si — o render usa `customHeight` real (só a estimativa estava errada).

```ts
// dentro de splitPhotos, antes do break por estouro:
if (i === 0 && rowH > budget) {
  // força a 1ª foto a entrar nesta página/continuação
  used = budget;
  i += consumed;
  break;
}
```

E no `addPhotoContinuations`, se mesmo numa página fresca (`TOTAL_BUDGET`) `fit` voltar vazio, forçar a primeira foto na próxima página em vez de `break` — caso patológico de fotos absurdamente altas.

### 2. Clamp do `customHeight` na estimativa

Limitar a estimativa por linha ao máximo possível (`TOTAL_BUDGET - TITLE_H - 20`) para que a paginação trate uma foto gigante como "ocupa página inteira" em vez de "estoura, descarta".

```ts
const MAX_ROW = TOTAL_BUDGET - TITLE_H - 20; // ~520
const estimatePhotoRowH = (p: PhotoItem) =>
  Math.min(MAX_ROW, (p.customHeight ?? 160) + 20 + ROW_GAP);
```

### 3. Render: respeitar o clamp visual

Em `InteractivePdfPage` (linha 1422), quando a foto está numa página de continuação e o `customHeight` é maior que o disponível, renderizar com `maxHeight` para não estourar visualmente a folha (apenas no preview — não afeta o PDF).

### 4. Pequena melhoria de estimativa de legenda

Trocar `+20` por `+24` em `estimatePhotoRowH` para cobrir legendas que quebram em 2 linhas (folga, não regressão).

## Validação

1. Abrir a obra `ArcelorMittal Pecém — CRONOGRAMA DE DESMOB`, ir até "4. INDICAÇÃO DE RESPONSÁVEL" → as 3 fotos do painel passam a renderizar no preview.
2. Redimensionar uma foto para altura grande e conferir que ela aparece (em página própria se necessário) em vez de sumir.
3. Baixar o PDF → continua idêntico (não tocamos no gerador).
4. Conferir uma seção com texto longo + várias fotos: paginação continua quebrando direito entre páginas sem perder fotos.

## Fora do escopo (sugestões para depois)

- Persistir fotos automaticamente no `service_report_photos` ao adicionar, para o estado em memória não divergir da DB (hoje, se o usuário fecha sem salvar, as fotos somem).
- Unificar paginação preview + PDF para evitar essa duplicação de lógica.
