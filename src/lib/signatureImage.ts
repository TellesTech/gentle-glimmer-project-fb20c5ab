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
