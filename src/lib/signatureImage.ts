/**
 * Helpers para exibir assinaturas gravadas em `report_signatures.signature_data`.
 *
 * Os valores podem chegar como:
 *  - data URL PNG ("data:image/png;base64,....")
 *  - URL http(s) de uma imagem hospedada
 *  - referência externa ("autentique:<id>") — sem imagem inline
 */

export type SignatureKind = 'image' | 'autentique' | 'none';

const SIGNATURE_WIDTH = 1600;
const SIGNATURE_HEIGHT = 480;
const SAFE_X = 140;
const SAFE_Y = 64;

/** Gera uma assinatura tipográfica em alta resolução sem depender do tamanho do nome. */
export async function generateTypedSignatureImage(name: string): Promise<string | null> {
  const normalizedName = name.trim();
  if (!normalizedName || typeof document === 'undefined') return null;

  try {
    await document.fonts.load('180px "Great Vibes"');
  } catch {
    // O fallback cursivo ainda produz uma assinatura completa se a fonte web falhar.
  }
  const fontFor = (size: number) => `${size}px "Great Vibes", cursive`;
  const measureCanvas = document.createElement('canvas');
  const measureContext = measureCanvas.getContext('2d');
  if (!measureContext) return null;

  const baseSize = 180;
  measureContext.font = fontFor(baseSize);
  const metrics = measureContext.measureText(normalizedName);
  const left = metrics.actualBoundingBoxLeft || 0;
  const right = metrics.actualBoundingBoxRight || metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || baseSize;
  const descent = metrics.actualBoundingBoxDescent || baseSize * 0.4;
  const measuredWidth = Math.max(left + right, metrics.width, 1);
  const measuredHeight = Math.max(ascent + descent, 1);
  const scale = Math.min(
    (SIGNATURE_WIDTH - SAFE_X * 2) / measuredWidth,
    (SIGNATURE_HEIGHT - SAFE_Y * 2) / measuredHeight,
    1,
  );
  const fontSize = Math.max(18, baseSize * scale);
  const ratio = fontSize / baseSize;

  const source = document.createElement('canvas');
  source.width = Math.ceil(measuredWidth * ratio + SAFE_X * 2);
  source.height = Math.ceil(measuredHeight * ratio + SAFE_Y * 2);
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) return null;
  sourceContext.font = fontFor(fontSize);
  sourceContext.fillStyle = '#1a1a1a';
  sourceContext.textAlign = 'left';
  sourceContext.textBaseline = 'alphabetic';
  sourceContext.fillText(
    normalizedName,
    SAFE_X + left * ratio,
    SAFE_Y + ascent * ratio,
  );

  const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (pixels.data[(y * source.width + x) * 4 + 3] > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;

  return placeInkOnSafeCanvas(source, minX, minY, maxX, maxY);
}

function placeInkOnSafeCanvas(
  source: HTMLCanvasElement,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): string | null {
  const inkWidth = maxX - minX + 1;
  const inkHeight = maxY - minY + 1;
  const output = document.createElement('canvas');
  output.width = SIGNATURE_WIDTH;
  output.height = SIGNATURE_HEIGHT;
  const context = output.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, output.width, output.height);
  const scale = Math.min(
    (output.width - SAFE_X * 2) / inkWidth,
    (output.height - SAFE_Y * 2) / inkHeight,
    1,
  );
  const width = inkWidth * scale;
  const height = inkHeight * scale;
  context.drawImage(
    source,
    minX,
    minY,
    inkWidth,
    inkHeight,
    (output.width - width) / 2,
    (output.height - height) / 2,
    width,
    height,
  );
  return output.toDataURL('image/png');
}

/** Remove espaços, quebras de linha e aspas envolventes de um valor de assinatura. */
export function normalizeSignatureSrc(value?: string | null): string | null {
  if (!value) return null;
  let v = String(value).trim();
  // remove aspas envolventes (valores que passaram por JSON.stringify duplo)
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  if (v.startsWith('data:image')) {
    const [header, ...rest] = v.split(',');
    const payload = rest.join(',').replace(/\s/g, '');
    if (!payload) return null;
    return `${header.replace(/\s/g, '')},${payload}`;
  }
  if (/^https?:\/\//i.test(v)) return v;
  return null;
}

export function getSignatureKind(value?: string | null): SignatureKind {
  if (!value) return 'none';
  if (String(value).trim().toLowerCase().startsWith('autentique:')) return 'autentique';
  return normalizeSignatureSrc(value) ? 'image' : 'none';
}

/**
 * Converte uma data URL em blob: URL. Útil quando o ambiente bloqueia
 * imagens `data:` inline (CSP `img-src`).
 * Retorna null se o valor não for uma data URL válida.
 */
export function dataUrlToBlobUrl(value?: string | null): string | null {
  const src = normalizeSignatureSrc(value);
  if (!src || !src.startsWith('data:')) return null;
  try {
    const [header, payload] = src.split(',');
    const mime = header.slice(5).split(';')[0] || 'image/png';
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
}

/**
 * Recorta apenas o espaço vazio da imagem e a recoloca sobre uma tela ampla,
 * com margem permanente. Assim, o mesmo bitmap pode ser reduzido na interface
 * ou no PDF sem encostar/cortar os floreios da assinatura.
 */
export async function normalizeSignatureImage(value?: string | null, signerName?: string | null): Promise<string | null> {
  const src = normalizeSignatureSrc(value);
  if (!src) return null;

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        // O gerador legado produzia PNGs 400x120 e podia cortar o fim de nomes
        // cursivos. Quando o nome é conhecido, a fonte tipográfica pode ser
        // reconstruída integralmente; imagens enviadas/desenhadas são mantidas.
        if (image.naturalWidth === 400 && image.naturalHeight === 120 && signerName?.trim()) {
          generateTypedSignatureImage(signerName).then((generated) => resolve(generated || src));
          return;
        }
        const source = document.createElement('canvas');
        source.width = image.naturalWidth || image.width;
        source.height = image.naturalHeight || image.height;
        const sourceContext = source.getContext('2d', { willReadFrequently: true });
        if (!sourceContext || source.width < 1 || source.height < 1) {
          resolve(src);
          return;
        }

        sourceContext.drawImage(image, 0, 0);
        const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
        let minX = source.width;
        let minY = source.height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < source.height; y += 1) {
          for (let x = 0; x < source.width; x += 1) {
            const index = (y * source.width + x) * 4;
            const alpha = pixels.data[index + 3];
            const isInk = alpha > 12 && (
              pixels.data[index] < 245
              || pixels.data[index + 1] < 245
              || pixels.data[index + 2] < 245
            );
            if (isInk) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }

        if (maxX < minX || maxY < minY) {
          resolve(src);
          return;
        }

        resolve(placeInkOnSafeCanvas(source, minX, minY, maxX, maxY) || src);
      } catch {
        // URLs sem CORS não permitem leitura dos pixels; ainda podem ser exibidas normalmente.
        resolve(src);
      }
    };
    image.onerror = () => resolve(src);
    image.src = src;
  });
}
