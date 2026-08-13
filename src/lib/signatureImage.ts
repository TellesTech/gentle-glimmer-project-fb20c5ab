/**
 * Helpers para exibir assinaturas gravadas em `report_signatures.signature_data`.
 *
 * Os valores podem chegar como:
 *  - data URL PNG ("data:image/png;base64,....")
 *  - URL http(s) de uma imagem hospedada
 *  - referência externa ("autentique:<id>") — sem imagem inline
 */

export type SignatureKind = 'image' | 'autentique' | 'none';

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
export async function normalizeSignatureImage(value?: string | null): Promise<string | null> {
  const src = normalizeSignatureSrc(value);
  if (!src) return null;

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
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

        const inkWidth = maxX - minX + 1;
        const inkHeight = maxY - minY + 1;
        const output = document.createElement('canvas');
        output.width = 1600;
        output.height = 480;
        const outputContext = output.getContext('2d');
        if (!outputContext) {
          resolve(src);
          return;
        }

        outputContext.fillStyle = '#ffffff';
        outputContext.fillRect(0, 0, output.width, output.height);
        const safeX = 120;
        const safeY = 60;
        const scale = Math.min(
          (output.width - safeX * 2) / inkWidth,
          (output.height - safeY * 2) / inkHeight,
        );
        const drawWidth = inkWidth * scale;
        const drawHeight = inkHeight * scale;
        outputContext.drawImage(
          source,
          minX,
          minY,
          inkWidth,
          inkHeight,
          (output.width - drawWidth) / 2,
          (output.height - drawHeight) / 2,
          drawWidth,
          drawHeight,
        );
        resolve(output.toDataURL('image/png'));
      } catch {
        // URLs sem CORS não permitem leitura dos pixels; ainda podem ser exibidas normalmente.
        resolve(src);
      }
    };
    image.onerror = () => resolve(src);
    image.src = src;
  });
}
