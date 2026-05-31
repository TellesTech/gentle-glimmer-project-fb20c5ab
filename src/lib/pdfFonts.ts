// Roboto registration for jsPDF.
//
// We use Roboto (Apache 2.0) because it has full Latin Extended coverage —
// Portuguese accents (Ó, Í, Ç, ã, ó, í…) render with correct glyph metrics,
// fixing the kerning/positioning bug that occurs when jsPDF's built-in
// Helvetica (WinAnsi, single-byte) is fed UTF-8 strings.
//
// The fonts are bundled as static assets (imported via Vite `?url`) so PDF
// generation never depends on a third-party CDN being reachable. This avoids
// silent fallbacks to Helvetica when the network is slow or blocked.
import type { jsPDF } from 'jspdf';

import RobotoRegular from '@/assets/fonts/Roboto-Regular.ttf?url';
import RobotoBold from '@/assets/fonts/Roboto-Bold.ttf?url';
import RobotoItalic from '@/assets/fonts/Roboto-Italic.ttf?url';
import RobotoBoldItalic from '@/assets/fonts/Roboto-BoldItalic.ttf?url';

const FONT_FAMILY = 'Roboto';

type FontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

const FONT_URLS: Record<FontStyle, string> = {
  normal: RobotoRegular,
  bold: RobotoBold,
  italic: RobotoItalic,
  bolditalic: RobotoBoldItalic,
};

// Cache the base64-encoded TTFs so we only fetch/encode once per session.
let cache: Promise<Partial<Record<FontStyle, string>>> | null = null;

async function fetchFontAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch font: ${url} (${res.status})`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function loadAllFonts(): Promise<Partial<Record<FontStyle, string>>> {
  // Use allSettled so a single failed style does not invalidate the others.
  const styles: FontStyle[] = ['normal', 'bold', 'italic', 'bolditalic'];
  const results = await Promise.allSettled(
    styles.map((s) => fetchFontAsBase64(FONT_URLS[s])),
  );
  const out: Partial<Record<FontStyle, string>> = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') out[styles[i]] = r.value;
  });
  return out;
}

export interface PdfFontHandle {
  /** jsPDF font family name to pass to setFont(). */
  family: string;
  /** Returns the closest available style, falling back within the same family. */
  style(want: FontStyle): FontStyle;
}

const HELVETICA_FALLBACK: PdfFontHandle = {
  family: 'helvetica',
  style: (s) => s,
};

/**
 * Registers Roboto in the given jsPDF document and returns a font handle.
 *
 * Returns a handle (instead of mutating module-level state) so concurrent
 * PDF generations don't accidentally use a font registered on a different
 * jsPDF instance.
 *
 * Falls back to Helvetica only if every Roboto style fails to load — in
 * practice this should never happen since the TTFs are bundled.
 */
export async function registerPdfFont(doc: jsPDF): Promise<PdfFontHandle> {
  try {
    if (!cache) cache = loadAllFonts();
    const fonts = await cache;

    const styleMap: Array<[FontStyle, string]> = [
      ['normal', 'Roboto-Regular.ttf'],
      ['bold', 'Roboto-Bold.ttf'],
      ['italic', 'Roboto-Italic.ttf'],
      ['bolditalic', 'Roboto-BoldItalic.ttf'],
    ];

    const available = new Set<FontStyle>();
    for (const [style, filename] of styleMap) {
      const data = fonts[style];
      if (!data) continue;
      try {
        doc.addFileToVFS(filename, data);
        doc.addFont(filename, FONT_FAMILY, style);
        available.add(style);
      } catch {
        // Continue — registration of one style failed, but others may work.
      }
    }

    if (available.size === 0) {
      // Nothing registered — fall back to helvetica.
      cache = null;
      return HELVETICA_FALLBACK;
    }

    doc.setFont(FONT_FAMILY, available.has('normal') ? 'normal' : Array.from(available)[0]);

    // Resolver picks the closest available style within Roboto so we never
    // accidentally switch to Helvetica mid-document if e.g. bolditalic is
    // missing (it falls back to bold, then to normal).
    const resolveStyle = (want: FontStyle): FontStyle => {
      if (available.has(want)) return want;
      if (want === 'bolditalic') {
        if (available.has('bold')) return 'bold';
        if (available.has('italic')) return 'italic';
      }
      if (want === 'bold' && available.has('normal')) return 'normal';
      if (want === 'italic' && available.has('normal')) return 'normal';
      return available.has('normal') ? 'normal' : (Array.from(available)[0] as FontStyle);
    };

    return { family: FONT_FAMILY, style: resolveStyle };
  } catch (e) {
    cache = null;
    // eslint-disable-next-line no-console
    console.warn('[pdfFonts] Roboto registration failed, falling back to helvetica.', e);
    return HELVETICA_FALLBACK;
  }
}
