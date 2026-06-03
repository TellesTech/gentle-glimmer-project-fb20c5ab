## Trocar tipografia da assinatura para Great Vibes

### O que será feito
1. **Adicionar link do Google Fonts** para "Great Vibes" no `index.html` (já existe preconnect).
2. **Atualizar `SignatureInput.tsx`** em 2 lugares:
   - Canvas 2D `ctx.font`: trocar `'italic 48px "Dancing Script", "Brush Script MT", cursive, serif'` por `'italic 48px "Great Vibes", "Dancing Script", cursive'`.
   - Preview HTML `style.fontFamily`: trocar `Dancing Script` por `Great Vibes`.

### O que NÃO muda
- Tamanho da fonte (48px / text-4xl), cor (#1a1a1a), alinhamento centralizado, funcionalidade de upload de imagem.

### Por que Great Vibes
- Cursiva elegante, manuscrita fina e refinada (estilo caneta-tinteiro), escolha confirmada pelo usuário.
