# Nomes longos cortados na assinatura (sistema e PDF)

## Causa

Na geração da assinatura digitada (`src/components/client/SignatureInput.tsx`), o texto é desenhado numa tela fixa de 1800x480 px e a redução de fonte para no mínimo 48px, usando apenas `measureText().width`. Em nomes longos com fonte cursiva (Great Vibes), a largura real da tinta (entradas e floreios finais) é maior que a medida, então parte do nome sai da tela e é literalmente apagada antes do recorte — o bitmap salvo já nasce cortado. Como o PDF apenas encaixa esse bitmap na caixa, o corte aparece nos dois lugares.

Além disso, no bloco de assinaturas do PDF o nome do assinante é impresso em linha única sem quebra, então nomes muito longos estouram a coluna.

## O que será feito

1. **Geração da assinatura sem corte** (`SignatureInput.tsx`)
   - Medir a tinta real com `actualBoundingBoxLeft/Right/Ascent/Descent` em vez de só `width`.
   - Dimensionar a tela de origem dinamicamente conforme o nome (largura e altura), com folga extra para floreios.
   - Reduzir a fonte até caber de fato (limite mínimo menor, ex.: 28px) e validar que a caixa de tinta não encosta nas bordas; se encostar, renderizar de novo com fonte menor.
   - Manter o recorte automático e a margem de segurança atuais no bitmap final.

2. **Exibição no sistema**
   - Garantir `object-contain` com espaço lateral suficiente na prévia e nos blocos de "Assinatura salva anteriormente" (`SignatureInput.tsx`, `SignatureImage.tsx`), para nomes largos aparecerem inteiros.

3. **PDF** (`src/lib/generateReportPdf.ts`)
   - Quebrar o nome do assinante em até 2 linhas com a largura disponível da coluna (usando `splitTextToSize`) e reduzir levemente a fonte quando necessário, ajustando a altura da caixa da assinatura.

Sem mudanças de banco de dados. Assinaturas já salvas cortadas continuarão cortadas até serem recapturadas (o bitmap antigo é o que está no banco).

## Validação
- Testar com nomes longos ("Ricardo Gabriel Barcelos", "Christiano Serra da Silva", "Karine Correa Deolindo") na prévia e no PDF gerado, conferindo primeira e última letra visíveis.
