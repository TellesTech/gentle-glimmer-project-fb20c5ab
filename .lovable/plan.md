### Correção: campo "Foto da Fábrica" não aparece no diálogo de editar/criar fábrica

**Problema:** O componente `ScrollArea` do shadcn/ui está colapsando a altura do viewport interno, fazendo com que o conteúdo no topo do diálogo (a seção "Foto da Fábrica") não seja renderizado/visível ao abrir o dialog.

**Arquivo afetado:** `src/components/companies/CompanyFormDialog.tsx`

**Mudanças:**

1. **Remover import do ScrollArea** — a linha `import { ScrollArea } from '@/components/ui/scroll-area';` será removida.

2. **Substituir `<ScrollArea>` por `<div>` com overflow nativo:**
   - Abertura: `<ScrollArea className="max-h-[calc(90vh-140px)]">` → `<div className="overflow-y-auto px-6 pb-6 pt-4" style={{ maxHeight: 'calc(90vh - 140px)' }}>`
   - Fechamento: `</ScrollArea>` → `</div>`

3. **Ajustar padding do conteúdo interno:** O `div` interno que envolve os campos tem `className="space-y-6 p-6 pt-4"`. Com o scroll na div externa e padding movido para ela, o padding duplicado será ajustado removendo o `p-6 pt-4` do div interno para evitar padding duplo.

**Resultado esperado:** Ao abrir "Editar Fábrica" ou "Nova Fábrica" no painel `/super-admin`, a seção "Foto da Fábrica" aparecerá imediatamente no topo do diálogo, com scroll funcional para o restante do formulário.