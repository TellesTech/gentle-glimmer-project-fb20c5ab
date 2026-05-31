## Corrigir cores dos cards de pasta no tema escuro

**Problema:** Em `src/components/reports/FolderCard.tsx`, o título e as estatísticas usam cores hardcoded (`text-neutral-900` e `text-neutral-700`) sobre `bg-card`. No tema escuro, o card fica escuro e o texto também, ficando ilegível (como na captura: nomes "ArcelorMittal", "Bracell", "X unidade(s)", "X relatório(s)" quase invisíveis).

**Correção (apenas UI, 1 arquivo):**

`src/components/reports/FolderCard.tsx`
- Linha 65: trocar `text-neutral-900` por `text-card-foreground`.
- Linha 70: trocar `text-neutral-700` por `text-muted-foreground`.

Isso usa os tokens semânticos do design system, garantindo contraste correto em ambos os temas sem alterar o visual no tema claro.

**Fora de escopo:** demais cards/telas, badge "Fábrica", botões de ação.