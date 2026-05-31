/**
 * Converte uma cor HEX para formato HSL (sem 'hsl()' wrapper)
 * Ex: #7A1B3E -> "338 65% 29%"
 */
export function hexToHsl(hex: string): string {
  // Remove o # se existir
  const cleanHex = hex.replace('#', '');
  
  // Converte para RGB
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  // Retorna no formato "H S% L%" (sem hsl() wrapper, como usado no Tailwind)
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Calcula cor de foreground (claro/escuro) baseado na luminosidade
 */
export function getForegroundColor(hex: string): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  // Fórmula de luminância relativa
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Se a cor é escura, retorna branco; se clara, retorna preto
  return luminance > 0.5 ? "0 0% 0%" : "0 0% 100%";
}
