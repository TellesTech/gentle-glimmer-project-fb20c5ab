import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getLogoBase64 } from './logoBase64';
import { registerPdfFont, type PdfFontHandle } from './pdfFonts';
import { formatSectionTitle, cleanSectionTitle } from './sectionNumbering';
import type { ContentBlock } from '@/components/service-reports/SectionEditor';
import type { PhotoItem } from '@/components/service-reports/PhotoBlockEditor';
import irataBrasilLogoFixed from '@/assets/irata-brasil.png';
import irataInternationalLogoFixed from '@/assets/irata-international.png';

// Active font handle. Updated by registerPdfFont() at the start of each
// generation. The resolver lets bold/italic fall back to closest available
// Roboto style (never silently to Helvetica).
// Module-level because addHeader/addFooter/renderRuns are module-level —
// generation runs sequentially within the call to generateServiceReportPdf().
let PDF_FONT_HANDLE: PdfFontHandle = { family: 'helvetica', style: (s) => s };

type FontStyleName = 'normal' | 'bold' | 'italic' | 'bolditalic';
function setF(doc: jsPDF, style: FontStyleName) {
  doc.setFont(PDF_FONT_HANDLE.family, PDF_FONT_HANDLE.style(style));
}

// ─────────────────────────────────────────────────────────────────────────
// HTML → PDF block parser
// Converts rich-text HTML (from TipTap or AI) into a normalized list of
// typed blocks the PDF renderer understands. Preserves <strong>/<b> as
// bold runs inside paragraphs and list items.
// ─────────────────────────────────────────────────────────────────────────
type TextRun = { text: string; bold?: boolean; italic?: boolean };
type ParsedBlock =
  | { type: 'heading'; level: 1 | 2 | 3; runs: TextRun[] }
  | { type: 'paragraph'; runs: TextRun[] }
  | { type: 'list'; items: TextRun[][] };

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(parseInt(n, 10)); } catch { return ''; }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ''; }
    });
}

/** Pre-sanitize raw HTML coming from TipTap/AI before block parsing. */
function sanitizeHtml(raw: string): string {
  let s = raw;
  // Drop HTML comments
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  // Drop script/style entirely (defensive)
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Normalize <br> to newlines
  s = s.replace(/<br\s*\/?>/gi, '\n');
  // Remove empty paragraphs/divs (with optional whitespace or &nbsp;)
  s = s.replace(/<(p|div)\b[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi, '');
  return s.trim();
}

// Tags that imply bold/italic when opened.
const BOLD_TAGS = new Set(['strong', 'b']);
const ITALIC_TAGS = new Set(['em', 'i']);
// Tags that we know about and want to track in the format stack.
// Anything else is consumed but left as a no-op (keeps text intact).
const TRACKED_INLINE_TAGS = new Set([
  'strong', 'b', 'em', 'i', 'u', 'span', 'a', 'sub', 'sup', 'mark',
  'small', 'font', 'code', 'cite', 'q',
]);

/** Extract text runs (with bold/italic markers) from a fragment of inline HTML. */
function extractRuns(inlineHtml: string): TextRun[] {
  if (!inlineHtml) return [];
  // Normalize <br> to newlines
  let html = inlineHtml.replace(/<br\s*\/?>/gi, '\n');
  const runs: TextRun[] = [];
  // Stack-based tag tracking (records the tag name so we can pop the matching one)
  const stack: { tag: string; bold: boolean; italic: boolean }[] = [
    { tag: '__root__', bold: false, italic: false },
  ];
  // Match ANY tag — we no longer drop text near unknown tags.
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?>/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    if (m.index > lastIdx) {
      const text = decodeEntities(html.slice(lastIdx, m.index));
      if (text) {
        const top = stack[stack.length - 1];
        runs.push({ text, bold: top.bold, italic: top.italic });
      }
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (closing) {
      // Pop until matching tag (or stop at root) — tolerates malformed nesting.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.splice(i, 1);
          break;
        }
      }
    } else {
      const top = stack[stack.length - 1];
      stack.push({
        tag,
        bold: top.bold || BOLD_TAGS.has(tag),
        italic: top.italic || ITALIC_TAGS.has(tag),
      });
      // Self-closing or void tags shouldn't stay on the stack.
      // (Rare in our input, but keeps the parser robust.)
      const isVoid = /\/>\s*$/.test(m[0]) || ['img', 'hr', 'br', 'meta', 'link'].includes(tag);
      if (isVoid) stack.pop();
      // Unknown tracked tag? still push; at least format stays intact.
      if (!TRACKED_INLINE_TAGS.has(tag) && !isVoid) {
        // No-op — push above already happened; we trust matching </tag> to pop.
      }
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < html.length) {
    const text = decodeEntities(html.slice(lastIdx));
    if (text) {
      const top = stack[stack.length - 1];
      runs.push({ text, bold: top.bold, italic: top.italic });
    }
  }
  // Coalesce adjacent runs with same formatting
  const merged: TextRun[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && !!last.bold === !!r.bold && !!last.italic === !!r.italic) {
      last.text += r.text;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

function runsToPlain(runs: TextRun[]): string {
  return runs.map((r) => r.text).join('');
}

/**
 * Find the matching closing tag for the block opened at `openEnd` (index just
 * after the opening tag), handling nested tags of the same name.
 * Returns the index of `<` of the matching `</tag>`, or -1 if none.
 */
function findMatchingClose(html: string, tag: string, openEnd: number): number {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = openEnd;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1] === '/') {
      depth -= 1;
      if (depth === 0) return m.index;
    } else {
      // Self-closing won't match for these block tags; treat as nested open.
      depth += 1;
    }
  }
  return -1;
}

/** Parse a full HTML string into block-level elements. */
function htmlToPdfBlocks(html: string | null | undefined): ParsedBlock[] {
  if (!html) return [];
  const trimmed = sanitizeHtml(html);
  if (!trimmed) return [];
  // If no tags at all, treat as a single plain paragraph (preserving \n as paragraph breaks)
  if (!/<[a-z][\s\S]*?>/i.test(trimmed)) {
    return trimmed
      .split(/\n{2,}/)
      .map((para) => ({ type: 'paragraph' as const, runs: [{ text: decodeEntities(para.trim()) }] }))
      .filter((b) => b.runs[0].text);
  }

  const blocks: ParsedBlock[] = [];
  // Linear scan that respects nested tags of the same name.
  const blockOpenRe = /<(h[1-3]|p|ul|ol|div)\b[^>]*>/gi;
  let cursor = 0;
  let m: RegExpExecArray | null;
  blockOpenRe.lastIndex = 0;

  const flushInline = (raw: string) => {
    if (!raw) return;
    const runs = extractRuns(raw);
    if (runsToPlain(runs).trim()) blocks.push({ type: 'paragraph', runs });
  };

  while ((m = blockOpenRe.exec(trimmed)) !== null) {
    if (m.index < cursor) continue;
    // Stray inline text before this block → paragraph
    if (m.index > cursor) {
      const between = trimmed.slice(cursor, m.index);
      if (/\S/.test(between.replace(/<[^>]+>/g, ''))) flushInline(between);
    }
    const tag = m[1].toLowerCase();
    const openEnd = m.index + m[0].length;
    const closeIdx = findMatchingClose(trimmed, tag, openEnd);
    if (closeIdx === -1) {
      // Unbalanced — consume the rest as one paragraph and stop.
      flushInline(trimmed.slice(openEnd));
      cursor = trimmed.length;
      break;
    }
    const inner = trimmed.slice(openEnd, closeIdx);
    if (tag.startsWith('h')) {
      const level = Math.min(3, Math.max(1, parseInt(tag.slice(1), 10))) as 1 | 2 | 3;
      const runs = extractRuns(inner);
      if (runsToPlain(runs).trim()) blocks.push({ type: 'heading', level, runs });
    } else if (tag === 'ul' || tag === 'ol') {
      const itemRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      const items: TextRun[][] = [];
      let im: RegExpExecArray | null;
      while ((im = itemRe.exec(inner)) !== null) {
        const runs = extractRuns(im[1]);
        if (runsToPlain(runs).trim()) items.push(runs);
      }
      if (items.length) blocks.push({ type: 'list', items });
    } else if (tag === 'div') {
      // Recurse — flatten <div> wrappers into their constituent blocks.
      const inner2 = inner.trim();
      if (inner2) {
        const sub = htmlToPdfBlocks(inner2);
        if (sub.length) blocks.push(...sub);
        else flushInline(inner2);
      }
    } else {
      // <p>
      const runs = extractRuns(inner);
      const plain = runsToPlain(runs).trim();
      if (plain) blocks.push({ type: 'paragraph', runs });
    }
    cursor = closeIdx + `</${tag}>`.length;
    blockOpenRe.lastIndex = cursor;
  }

  // Tail content
  if (cursor < trimmed.length) {
    const tail = trimmed.slice(cursor);
    if (/\S/.test(tail.replace(/<[^>]+>/g, ''))) flushInline(tail);
  }

  // Nothing matched at all → one big paragraph
  if (!blocks.length) {
    const runs = extractRuns(trimmed);
    if (runsToPlain(runs).trim()) blocks.push({ type: 'paragraph', runs });
  }
  return blocks;
}

function normalizeForCompare(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\s*\d+(\.\d+)*\.?\s*[-–—]?\s*/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Remove parágrafos/itens de lista duplicados DENTRO de um único HTML parseado.
 * Cobre casos onde a IA/conteúdo salvou o mesmo texto repetido (ex.: parágrafo
 * normal seguido do mesmo texto em negrito).
 */
function dedupeParsedBlocks(blocks: ParsedBlock[]): ParsedBlock[] {
  if (!blocks.length) return blocks;
  const seen: string[] = [];
  const result: ParsedBlock[] = [];

  const isDup = (text: string): boolean => {
    const n = normalizeForCompare(text);
    if (!n || n.length < 12) return false;
    for (const prev of seen) {
      if (prev === n) return true;
      // Considera duplicado se o novo texto contém um anterior (caso comum:
      // IA gera 2 parágrafos separados e depois um 3º com ambos colados em
      // negrito) OU se um anterior contém o novo (caso inverso).
      if (n.includes(prev) && prev.length > 30) return true;
      if (prev.includes(n) && n.length > 30) return true;
    }
    // Também detecta concatenação de DOIS ou mais blocos anteriores:
    // se o novo texto contém ≥2 itens já vistos, é uma versão "agrupada" e
    // deve ser descartada em favor dos blocos individuais já presentes.
    let containedCount = 0;
    for (const prev of seen) {
      if (prev.length > 20 && n.includes(prev)) containedCount++;
      if (containedCount >= 2) return true;
    }
    seen.push(n);
    return false;
  };

  for (const b of blocks) {
    if (b.type === 'paragraph') {
      if (isDup(runsToPlain(b.runs))) continue;
      result.push(b);
    } else if (b.type === 'list') {
      const filteredItems = b.items.filter((runs) => !isDup(runsToPlain(runs)));
      if (filteredItems.length) result.push({ type: 'list', items: filteredItems });
    } else {
      seen.push(normalizeForCompare(runsToPlain(b.runs)));
      result.push(b);
    }
  }
  return result;
}

/** Drops the first heading inside a content HTML if it duplicates the section title. */
function stripDuplicateHeading(blocks: ParsedBlock[], sectionTitle: string): ParsedBlock[] {
  if (!blocks.length) return blocks;
  const titleNorm = normalizeForCompare(cleanSectionTitle(sectionTitle));
  if (!titleNorm) return blocks;
  const first = blocks[0];
  if (first.type === 'heading') {
    const headNorm = normalizeForCompare(runsToPlain(first.runs));
    // Strict equality only: substring matches were eating valid sub-headings
    // (e.g. section "Conclusão e Recomendações" was swallowing a child "Recomendações").
    if (headNorm === titleNorm) {
      return blocks.slice(1);
    }
  }
  return blocks;
}

interface ServiceReportData {
  title: string;
  clientName: string;
  clientUnit: string;
  clientContact: string;
  subject: string;
  scopeDescription: string;
  startDate: string;
  endDate: string;
  safetyNotes: string;
  conclusion: string;
  code: string;
  revision: number;
  coverImageUrl?: string | null;
  coverPhotos?: string[];
  showIrataSeals?: boolean;
  irataLogoBrasilUrl?: string | null;
  irataLogoInternationalUrl?: string | null;
  /**
   * Imagem (data URL ou URL) já renderizada da capa exibida no editor.
   * Quando presente, o gerador usa essa imagem como página 1 do PDF
   * em vez de redesenhar a capa programaticamente — garantindo paridade
   * visual perfeita com o preview do sistema.
   */
  coverRenderedImage?: string | null;
  sections: {
    id: string;
    title: string;
    sectionType: string;
    content: ContentBlock[];
    photos: PhotoItem[];
  }[];
}

// Colors
const COLORS = {
  primary: { r: 153, g: 25, b: 25 },
  dark: { r: 33, g: 33, b: 33 },
  muted: { r: 100, g: 100, b: 100 },
  light: { r: 240, g: 240, b: 240 },
  white: { r: 255, g: 255, b: 255 },
  border: { r: 200, g: 200, b: 200 },
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 18;
const FOOTER_HEIGHT = 12;

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = base64;
  });
}

function fitImageToBox(imgW: number, imgH: number, boxW: number, boxH: number) {
  const imgRatio = imgW / imgH;
  const boxRatio = boxW / boxH;
  let w: number, h: number;
  if (imgRatio > boxRatio) {
    w = boxW;
    h = boxW / imgRatio;
  } else {
    h = boxH;
    w = boxH * imgRatio;
  }
  return { width: w, height: h, offsetX: (boxW - w) / 2, offsetY: (boxH - h) / 2 };
}

// ─────────────────────────────────────────────────────────────────────────
// Rich text renderer: draws a sequence of TextRuns with mixed bold/italic
// across multiple lines, with proper word wrapping. Returns the new Y.
// ─────────────────────────────────────────────────────────────────────────
function setRunFont(doc: jsPDF, run: TextRun) {
  if (run.bold && run.italic) setF(doc, 'bolditalic');
  else if (run.bold) setF(doc, 'bold');
  else if (run.italic) setF(doc, 'italic');
  else setF(doc, 'normal');
}

// Pre-computed dimensions for the header logo. The header logo box is
// nominally 20×10 mm but we shrink dimensions to preserve the original
// aspect ratio so the WEES mark never appears stretched.
interface HeaderLogo {
  data: string;
  width: number;
  height: number;
  offsetY: number; // vertical centering inside the 10mm-tall box
}

async function prepareHeaderLogo(logoBase64: string | null): Promise<HeaderLogo | null> {
  if (!logoBase64) return null;
  try {
    const dims = await getImageDimensions(logoBase64);
    const BOX_W = 20;
    const BOX_H = 10;
    const scale = Math.min(BOX_W / dims.width, BOX_H / dims.height);
    const w = dims.width * scale;
    const h = dims.height * scale;
    return { data: logoBase64, width: w, height: h, offsetY: (BOX_H - h) / 2 };
  } catch {
    return null;
  }
}

interface RichDrawOptions {
  x: number;
  maxWidth: number;
  fontSize: number;
  lineHeight: number; // mm per line
  color: { r: number; g: number; b: number };
  // Receives the CURRENT y so the page-break check is always accurate.
  // The previous signature `(needed) => …` captured a stale outer y via
  // closure and produced overlapping text on multi-line content.
  pageBreak: (needed: number, currentY: number) => number;
}

/**
 * Normalize whitespace across runs to avoid visible gaps and stuck words.
 * - Collapses runs of tabs/spaces inside each run into a single space.
 * - Trims duplicate spaces at run boundaries (run A ends with " " AND run B starts with " ").
 * - Trims leading whitespace on the first run and trailing on the last.
 * - Preserves '\n' which carries explicit line-break semantics.
 */
function normalizeRunsWhitespace(runs: TextRun[]): TextRun[] {
  const cleaned = runs
    .map((r) => ({ ...r, text: (r.text ?? '').replace(/[\t ]+/g, ' ') }))
    .filter((r) => r.text.length > 0);
  if (cleaned.length === 0) return cleaned;

  // Trim leading whitespace on first run, trailing on last run.
  cleaned[0].text = cleaned[0].text.replace(/^[ \t]+/, '');
  const last = cleaned[cleaned.length - 1];
  last.text = last.text.replace(/[ \t]+$/, '');

  // Collapse boundary whitespace: if a run ends with space and next starts with space, drop one side.
  for (let i = 0; i < cleaned.length - 1; i++) {
    const a = cleaned[i];
    const b = cleaned[i + 1];
    if (/[ \t]$/.test(a.text) && /^[ \t]/.test(b.text)) {
      b.text = b.text.replace(/^[ \t]+/, '');
    }
  }
  return cleaned.filter((r) => r.text.length > 0);
}

function drawRichRuns(
  doc: jsPDF,
  runs: TextRun[],
  startY: number,
  opts: RichDrawOptions,
): number {
  // Pre-clean whitespace so multi-space sequences (from AI text or merged
  // adjacent runs) don't render as visible gaps between words.
  const cleanRuns = normalizeRunsWhitespace(runs);

  // Ensure the first line fits on the current page
  let y = opts.pageBreak(opts.lineHeight, startY);
  let cursorX = opts.x;
  // Tracks the run currently being drawn so wrap() can re-apply its font
  // style after a page break (header/footer mutate font/size).
  let activeRun: TextRun | null = null;

  const applyState = () => {
    doc.setFontSize(opts.fontSize);
    doc.setCharSpace(0);
    doc.setTextColor(opts.color.r, opts.color.g, opts.color.b);
    if (activeRun) setRunFont(doc, activeRun);
  };

  applyState();

  const wrap = () => {
    y += opts.lineHeight;
    const beforeY = y;
    y = opts.pageBreak(opts.lineHeight, y);
    cursorX = opts.x;
    // If pageBreak rewrote y (i.e. we crossed to a new page), the header
    // drawing left fontSize=7, style='normal', and an italic footer behind it.
    // Reapply our drawing state so the next token renders identically to the
    // text on the previous page.
    if (y !== beforeY) applyState();
  };

  for (const run of cleanRuns) {
    if (!run.text) continue;
    activeRun = run;
    setRunFont(doc, run);
    const lines = run.text.split('\n');
    for (let li = 0; li < lines.length; li++) {
      const segment = lines[li];
      const tokens = segment.match(/\S+\s*/g) || [];
      for (const token of tokens) {
        const tokenWidth = doc.getTextWidth(token);
        const remaining = opts.maxWidth - (cursorX - opts.x);
        if (tokenWidth > remaining && cursorX > opts.x) {
          wrap();
        }
        if (tokenWidth > opts.maxWidth) {
          // Hard break: token wider than the column
          let buf = '';
          for (const ch of token) {
            const candidate = buf + ch;
            if (doc.getTextWidth(candidate) > opts.maxWidth && buf) {
              doc.text(buf, cursorX, y + opts.lineHeight - 1);
              wrap();
              buf = ch;
            } else {
              buf = candidate;
            }
          }
          if (buf) {
            doc.text(buf, cursorX, y + opts.lineHeight - 1);
            cursorX += doc.getTextWidth(buf);
          }
        } else {
          doc.text(token, cursorX, y + opts.lineHeight - 1);
          cursorX += tokenWidth;
        }
      }
      if (li < lines.length - 1) wrap();
    }
  }
  // Advance below the last line
  return y + opts.lineHeight;
}

// ─────────────────────────────────────────────────────────────────────────
// Photo grid packer — TECHNICAL GRID
// Forces a clean, predictable 1 / 2 / 2 grid in the PDF regardless of the
// editor's free-form layout. This eliminates overlap with text/headers and
// guarantees a professional documentary look.
//   1 photo  → full width
//   2 photos → 2 columns
//   3+ photos → 2 columns, sequential rows (last row may have a single tile
//               centered on the page when count is odd).
// Heights are computed from the slot width, capped by safe absolute values.
// ─────────────────────────────────────────────────────────────────────────
type PhotoSlot = { photo: PhotoItem; x: number; w: number; h: number };

function planPhotoRows(
  photos: PhotoItem[],
  contentX: number,
  contentW: number,
  gap = 4,
): { rows: PhotoSlot[][]; rowHeights: number[] } {
  const rows: PhotoSlot[][] = [];
  const rowHeights: number[] = [];

  if (photos.length === 0) return { rows, rowHeights };

  const total = photos.length;

  // Single full-width photo
  if (total === 1) {
    const slotW = contentW;
    const rowH = Math.min(95, slotW * 0.56);
    rows.push([{ photo: photos[0], x: contentX, w: slotW, h: rowH }]);
    rowHeights.push(rowH);
    return { rows, rowHeights };
  }

  // 2+ photos → strict 2-column grid
  const cols = 2;
  const slotW = (contentW - gap * (cols - 1)) / cols;
  // 4:3 aspect, capped to avoid overflowing a page
  const stdRowH = Math.min(70, Math.max(50, slotW * 0.72));

  let i = 0;
  while (i < total) {
    const remaining = total - i;
    if (remaining === 1) {
      // Center the last orphan tile to keep the page balanced
      const last = photos[i];
      const tileW = slotW; // keep half width to match the grid above
      const xCentered = contentX + (contentW - tileW) / 2;
      rows.push([{ photo: last, x: xCentered, w: tileW, h: stdRowH }]);
      rowHeights.push(stdRowH);
      i += 1;
    } else {
      const slice = photos.slice(i, i + cols);
      const slots: PhotoSlot[] = slice.map((p, idx) => ({
        photo: p,
        x: contentX + idx * (slotW + gap),
        w: slotW,
        h: stdRowH,
      }));
      rows.push(slots);
      rowHeights.push(stdRowH);
      i += cols;
    }
  }
  return { rows, rowHeights };
}

/** Cover-fit (crop to fill the box, like CSS object-fit: cover) */
function coverImageToBox(imgW: number, imgH: number, boxW: number, boxH: number) {
  const imgRatio = imgW / imgH;
  const boxRatio = boxW / boxH;
  let w: number, h: number;
  if (imgRatio > boxRatio) {
    h = boxH;
    w = boxH * imgRatio;
  } else {
    w = boxW;
    h = boxW / imgRatio;
  }
  return { width: w, height: h, offsetX: (boxW - w) / 2, offsetY: (boxH - h) / 2 };
}

/**
 * Pré-recorta uma imagem (base64) usando estratégia "object-fit: cover" e devolve
 * um JPEG no tamanho exato do slot (em pixels). Necessário porque jsPDF.addImage
 * não faz clipping — sem isso, fotos vazam para fora do retângulo do slot.
 */
async function coverCropToCanvas(
  base64: string,
  targetWmm: number,
  targetHmm: number,
  pxPerMm = 6,
  quality = 0.9,
): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = base64;
    });
    const targetW = Math.max(1, Math.round(targetWmm * pxPerMm));
    const targetH = Math.max(1, Math.round(targetHmm * pxPerMm));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Estratégia "cover": calcula o retângulo de origem para preencher o destino sem deformação.
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = targetW / targetH;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (imgRatio > boxRatio) {
      // imagem mais larga que o slot — corta nas laterais
      sw = img.naturalHeight * boxRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      // imagem mais alta que o slot — corta em cima/baixo
      sh = img.naturalWidth / boxRatio;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

function addHeader(doc: jsPDF, code: string, revision: number, headerLogo: HeaderLogo | null, pageNum: number) {
  // Defensive reset: cover may have left a residual charSpace value (its async
  // IRATA seal rendering can interleave with setCharSpace calls). Without this
  // the header text on every internal page renders with broken kerning.
  doc.setCharSpace(0);
  const y = 10;

  // Logo — drawn at its natural aspect ratio inside a 20×10mm box so the
  // WEES mark never appears horizontally stretched.
  if (headerLogo) {
    try {
      doc.addImage(
        headerLogo.data,
        'PNG',
        MARGIN,
        y + headerLogo.offsetY,
        headerLogo.width,
        headerLogo.height,
        undefined,
        'FAST',
      );
    } catch { /* ignore */ }
  } else {
    doc.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.roundedRect(MARGIN, y, 14, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    setF(doc, 'bold');
    doc.text('WEES', MARGIN + 7, y + 6, { align: 'center' });
  }

  // Title
  doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
  doc.setFontSize(10);
  setF(doc, 'bold');
  doc.text('RELATÓRIO DE SERVIÇOS', PAGE_WIDTH / 2, y + 6, { align: 'center' });

  // Info
  doc.setFontSize(7);
  setF(doc, 'normal');
  doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b);
  const rightX = PAGE_WIDTH - MARGIN;
  doc.text(`Cód: ${code || 'RS-000'}`, rightX, y + 3, { align: 'right' });
  doc.text(`Rev: ${String(revision).padStart(2, '0')}`, rightX, y + 6, { align: 'right' });
  doc.text(`Pág: ${pageNum}`, rightX, y + 9, { align: 'right' });

  // Line
  doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 12, PAGE_WIDTH - MARGIN, y + 12);

  return y + HEADER_HEIGHT;
}

function addFooter(doc: jsPDF) {
  // Defensive reset — same rationale as addHeader.
  doc.setCharSpace(0);
  const y = PAGE_HEIGHT - 10;
  doc.setFontSize(6);
  doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b);
  setF(doc, 'italic');
  doc.text(
    'Este documento é propriedade da WEES Engenharia e não pode ser reproduzido sem autorização prévia.',
    PAGE_WIDTH / 2,
    y,
    { align: 'center' }
  );
}

function checkPageBreak(doc: jsPDF, currentY: number, needed: number, code: string, revision: number, headerLogo: HeaderLogo | null, pageCount: { count: number }): number {
  if (currentY + needed > PAGE_HEIGHT - FOOTER_HEIGHT - MARGIN) {
    addFooter(doc);
    doc.addPage();
    pageCount.count++;
    return addHeader(doc, code, revision, headerLogo, pageCount.count);
  }
  return currentY;
}

export async function generateServiceReportPdf(data: ServiceReportData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  // Register Roboto so accented characters (Ó, Í, Ç, ã…) render with correct
  // glyph metrics. Falls back to helvetica only if every Roboto style fails.
  PDF_FONT_HANDLE = await registerPdfFont(doc);
  const logoBase64 = await getLogoBase64();
  const headerLogo = await prepareHeaderLogo(logoBase64);
  const pageCount = { count: 1 };

  // ===== COVER PAGE =====
  // Se a UI capturou a capa exatamente como aparece no editor, usamos
  // essa imagem para a primeira página do PDF (paridade visual perfeita).
  // Caso contrário, caímos no desenho programático abaixo.
  let coverHandled = false;
  if (data.coverRenderedImage) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');
      // A imagem capturada já está na proporção 210:297 (A4)
      doc.addImage(data.coverRenderedImage, 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT, undefined, 'FAST');
      coverHandled = true;
    } catch (e) {
      // Falha silenciosa — segue o fluxo programático.
      coverHandled = false;
    }
  }

  if (!coverHandled) {
  // ===== COVER PAGE — Editorial Magazine Style (fallback) =====
  const COVER_RED = COLORS.primary;
  const SEAL_BLUE = { r: 30, g: 58, b: 138 };
  const photos = (data.coverPhotos && data.coverPhotos.length > 0)
    ? data.coverPhotos.filter(Boolean)
    : (data.coverImageUrl ? [data.coverImageUrl] : []);

  // White background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

  // Footer bands (mais finos para quebrar o "L")
  const FOOTER_BAND_H = 11;
  const ADDR_BAND_H = 8;
  const MAIN_AREA_H = PAGE_HEIGHT - FOOTER_BAND_H - ADDR_BAND_H;

  // Left red column (~38%)
  const LEFT_W = PAGE_WIDTH * 0.38;
  doc.setFillColor(COVER_RED.r, COVER_RED.g, COVER_RED.b);
  doc.rect(0, 0, LEFT_W, MAIN_AREA_H, 'F');

  // Date labels — fallback to today
  let coverDate = new Date();
  if (data.startDate) {
    try { coverDate = new Date(data.startDate); } catch { /* ignore */ }
  }
  const monthLabel = format(coverDate, 'MMMM', { locale: ptBR }).toUpperCase();
  const yearLabel = format(coverDate, 'yyyy');

  const PAD_X = 16;

  // ── TOP — WEES Logo (em destaque) + data secundária
  let topY = 22;
  if (logoBase64) {
    try {
      const dims = await getImageDimensions(logoBase64);
      const maxW = LEFT_W - PAD_X * 2;
      const maxH = 13;
      // Escala uniforme — preserva o aspect ratio em ambos os eixos.
      const scale = Math.min(maxW / dims.width, maxH / dims.height);
      const logoW = dims.width * scale;
      const logoH = dims.height * scale;
      doc.addImage(logoBase64, 'PNG', PAD_X, topY, logoW, logoH, undefined, 'FAST');
      topY += logoH + 4;
    } catch { /* ignore */ }
  } else {
    // Fallback "WEES" text
    doc.setTextColor(255, 255, 255);
    setF(doc, 'bold');
    doc.setFontSize(16);
    doc.text('WEES', PAD_X, topY + 4);
    topY += 9;
  }

  // Linha divisória branca
  doc.setFillColor(255, 255, 255);
  doc.rect(PAD_X, topY, 11, 0.4, 'F');
  topY += 5;

  // Mês / Ano — letterspacing real via setCharSpace, ano alinhado pela baseline
  const baselineY = topY + 4;
  doc.setTextColor(255, 255, 255);
  setF(doc, 'normal');
  doc.setFontSize(7.5);
  doc.setCharSpace(0.7);
  doc.text(monthLabel, PAD_X, baselineY);
  const monthW = doc.getTextWidth(monthLabel);
  doc.setCharSpace(0);
  // Ano: maior, bold, alinhado à mesma baseline
  setF(doc, 'bold');
  doc.setFontSize(13);
  doc.text(yearLabel, PAD_X + monthW + 3, baselineY);

  // ── MIDDLE — Title + Technical metadata table
  // Metadata table
  const todayLabel = format(new Date(), 'dd/MM/yyyy');
  const metaRows: { label: string; value: string }[] = [
    { label: 'CÓDIGO', value: data.code || 'RS-000' },
    { label: 'REVISÃO', value: String(data.revision ?? 0).padStart(2, '0') },
    { label: 'DATA', value: todayLabel },
  ];
  if (data.clientName) metaRows.push({ label: 'CLIENTE', value: data.clientName.toUpperCase() });
  if (data.clientUnit) metaRows.push({ label: 'UNIDADE', value: data.clientUnit.toUpperCase() });

  // Layout vertical: label em cima, valor embaixo (full-width da coluna esquerda).
  // Isso evita que valores longos como "ARCELORMITTAL PECÉM - PECÉM" quebrem
  // em palavras curtas como acontecia quando label/valor dividiam a faixa horizontal.
  const VALUE_FONT_BASE = 8;
  const LABEL_FONT = 5.8;
  const LABEL_LINE_H = 2.6;     // altura da linha do label
  const VALUE_LINE_H = 3.4;     // altura de cada linha do valor
  const ROW_GAP = 1.2;          // espaço extra entre linhas (após o divisor)
  const valueMaxW = LEFT_W - PAD_X * 2;
  const rowsWithLines = metaRows.map((r) => {
    // Auto-shrink: começa em VALUE_FONT_BASE; se ainda quebrar em >2 linhas, reduz.
    let fontSize = VALUE_FONT_BASE;
    setF(doc, 'bold');
    doc.setFontSize(fontSize);
    let lines = doc.splitTextToSize(r.value, valueMaxW) as string[];
    if (lines.length > 2) {
      fontSize = 7;
      doc.setFontSize(fontSize);
      lines = doc.splitTextToSize(r.value, valueMaxW) as string[];
    }
    if (lines.length > 2) {
      fontSize = 6.5;
      doc.setFontSize(fontSize);
      lines = doc.splitTextToSize(r.value, valueMaxW) as string[];
    }
    const h = LABEL_LINE_H + lines.length * VALUE_LINE_H + ROW_GAP;
    return { ...r, lines, h, fontSize };
  });
  const tableTotalH = rowsWithLines.reduce((acc, r) => acc + r.h, 0);

  // Âncora da tabela: encostada acima da seção de selos (que fica em ~MAIN_AREA_H - 22)
  const SEAL_TOP = MAIN_AREA_H - 30;
  let metaY = SEAL_TOP - tableTotalH - 4;
  if (metaY < topY + 50) metaY = topY + 50; // garante espaço pro título

  // Eyebrow + título posicionados acima da tabela
  setF(doc, 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.setCharSpace(0.55);
  doc.text('DOCUMENTO TÉCNICO', PAD_X, metaY - 22);
  doc.setCharSpace(0);

  setF(doc, 'bold');
  doc.setFontSize(17);
  doc.text('RELATÓRIO', PAD_X, metaY - 13);
  doc.text('DE SERVIÇOS', PAD_X, metaY - 5);

  // Top divider
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.12);
  doc.line(PAD_X, metaY, LEFT_W - 8, metaY);

  for (const row of rowsWithLines) {
    const rowTopY = metaY;
    metaY += row.h;
    // Label em cima
    setF(doc, 'normal');
    doc.setFontSize(LABEL_FONT);
    doc.setTextColor(255, 255, 255);
    doc.setCharSpace(0.4);
    doc.text(row.label, PAD_X, rowTopY + LABEL_LINE_H);
    doc.setCharSpace(0);
    // Valor abaixo, ocupando toda a largura disponível
    setF(doc, 'bold');
    doc.setFontSize(row.fontSize);
    row.lines.forEach((ln, i) => {
      doc.text(ln, PAD_X, rowTopY + LABEL_LINE_H + (i + 1) * VALUE_LINE_H);
    });
    // Bottom divider
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.12);
    doc.line(PAD_X, metaY, LEFT_W - 8, metaY);
  }

  // ── BOTTOM — Certificadora (slots quadrados, sem fundo branco)
  if (data.showIrataSeals !== false) {
    const slotW = 16;
    const slotH = 16;
    const slotGap = 5;
    const sealsBlockW = slotW * 2 + slotGap;
    const sealsCenterX = PAD_X + sealsBlockW / 2;
    const sealLabelY = MAIN_AREA_H - 26;
    setF(doc, 'bold');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.setCharSpace(0.55);
    doc.text('CERTIFICADORA', sealsCenterX, sealLabelY, { align: 'center' });
    doc.setCharSpace(0);

    const slotY = sealLabelY + 3;

    const drawIrataSlot = async (
      x: number,
      y: number,
      w: number,
      h: number,
      url: string | null | undefined,
      fallbackAsset: string,
      label: string,
    ) => {
      const candidates = [url, fallbackAsset].filter(Boolean) as string[];
      for (const src of candidates) {
        try {
          const b64 = await loadImageAsBase64(src);
          if (b64) {
            const dims = await getImageDimensions(b64);
            const fit = fitImageToBox(dims.width, dims.height, w, h);
            doc.addImage(
              b64, 'PNG',
              x + fit.offsetX, y + fit.offsetY,
              fit.width, fit.height,
              undefined, 'FAST'
            );
            return;
          }
        } catch { /* try next */ }
      }
      // Placeholder — dashed border
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.15);
      doc.setLineDashPattern([0.6, 0.6], 0);
      doc.roundedRect(x, y, w, h, 0.6, 0.6, 'S');
      doc.setLineDashPattern([], 0);
      doc.setTextColor(255, 255, 255);
      setF(doc, 'bold');
      doc.setFontSize(5);
      doc.text(label, x + w / 2, y + h / 2 + 0.7, { align: 'center' });
    };

    await drawIrataSlot(PAD_X, slotY, slotW, slotH, data.irataLogoBrasilUrl, irataBrasilLogoFixed, 'BRASIL');
    await drawIrataSlot(PAD_X + slotW + slotGap, slotY, slotW, slotH, data.irataLogoInternationalUrl, irataInternationalLogoFixed, 'INTL');
  }

  // ===== RIGHT WHITE AREA =====
  const RIGHT_X = LEFT_W;
  const RIGHT_W = PAGE_WIDTH - LEFT_W;

  // Thin vertical accent line at boundary
  doc.setFillColor(COVER_RED.r, COVER_RED.g, COVER_RED.b);
  doc.rect(RIGHT_X, 0, 0.5, MAIN_AREA_H, 'F');

  // ── Photo mosaic / technical empty state
  const MOSAIC_PADDING_X = 14;
  const MOSAIC_PADDING_TOP = 22;
  const MOSAIC_PADDING_BOTTOM = 26;
  const mosaicX = RIGHT_X + MOSAIC_PADDING_X;
  const mosaicY = MOSAIC_PADDING_TOP;
  const mosaicW = RIGHT_W - MOSAIC_PADDING_X * 2;
  const mosaicH = MAIN_AREA_H - MOSAIC_PADDING_TOP - MOSAIC_PADDING_BOTTOM;
  const GAP = 4;

  type Slot = { x: number; y: number; w: number; h: number };
  const computeSlots = (count: number): Slot[] => {
    if (count <= 0) return [];
    if (count === 1) return [{ x: mosaicX, y: mosaicY, w: mosaicW, h: mosaicH }];
    if (count === 2) {
      const h1 = mosaicH * 0.6 - GAP / 2;
      const h2 = mosaicH * 0.4 - GAP / 2;
      return [
        { x: mosaicX, y: mosaicY, w: mosaicW, h: h1 },
        { x: mosaicX, y: mosaicY + h1 + GAP, w: mosaicW, h: h2 },
      ];
    }
    if (count === 3) {
      const w1 = mosaicW * 0.6 - GAP / 2;
      const w2 = mosaicW * 0.4 - GAP / 2;
      const halfH = (mosaicH - GAP) / 2;
      return [
        { x: mosaicX, y: mosaicY, w: w1, h: mosaicH },
        { x: mosaicX + w1 + GAP, y: mosaicY, w: w2, h: halfH },
        { x: mosaicX + w1 + GAP, y: mosaicY + halfH + GAP, w: w2, h: halfH },
      ];
    }
    const halfW = (mosaicW - GAP) / 2;
    const halfH = (mosaicH - GAP) / 2;
    return [
      { x: mosaicX, y: mosaicY, w: halfW, h: halfH },
      { x: mosaicX + halfW + GAP, y: mosaicY, w: halfW, h: halfH },
      { x: mosaicX, y: mosaicY + halfH + GAP, w: halfW, h: halfH },
      { x: mosaicX + halfW + GAP, y: mosaicY + halfH + GAP, w: halfW, h: halfH },
    ];
  };

  const slots = computeSlots(Math.min(photos.length, 4));
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const b64 = await loadImageAsBase64(photos[i]);
    if (!b64) continue;
    try {
      // Placeholder cinza sutil caso o crop falhe.
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(s.x, s.y, s.w, s.h, 1.2, 1.2, 'F');

      // Pré-recorta no tamanho exato do slot (object-fit: cover) para evitar
      // que a imagem extrapole o retângulo e invada a coluna vermelha.
      const cropped = await coverCropToCanvas(b64, s.w, s.h, 6, 0.9);
      if (cropped) {
        doc.addImage(cropped, 'JPEG', s.x, s.y, s.w, s.h, undefined, 'FAST');
      }
    } catch { /* ignore */ }
  }

  // Empty-state — elegant technical watermark when no cover photos are provided.
  // Faint background panel + centered "W" monogram + thin geometric corner lines.
  if (photos.length === 0) {
    // Soft panel background
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(mosaicX, mosaicY, mosaicW, mosaicH, 2, 2, 'F');

    // Centered monogram "W" (very light gray)
    const cx = mosaicX + mosaicW / 2;
    const cy = mosaicY + mosaicH / 2;
    doc.setTextColor(232, 232, 232);
    setF(doc, 'bold');
    doc.setFontSize(96);
    doc.text('W', cx, cy + 12, { align: 'center' });

    // Thin geometric accent — bottom-right corner lines
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.25);
    const cornerX = mosaicX + mosaicW - 18;
    const cornerY = mosaicY + mosaicH - 18;
    doc.line(cornerX, mosaicY + mosaicH - 4, mosaicX + mosaicW - 4, mosaicY + mosaicH - 4);
    doc.line(mosaicX + mosaicW - 4, cornerY, mosaicX + mosaicW - 4, mosaicY + mosaicH - 4);
    doc.line(cornerX, mosaicY + mosaicH - 8, mosaicX + mosaicW - 8, mosaicY + mosaicH - 8);
    doc.line(mosaicX + mosaicW - 8, cornerY + 4, mosaicX + mosaicW - 8, mosaicY + mosaicH - 8);

    // Top-left subtle eyebrow label
    doc.setTextColor(200, 200, 200);
    setF(doc, 'normal');
    doc.setFontSize(6);
    doc.text('W E E S   E N G E N H A R I A', mosaicX + 2, mosaicY + 5);
  }

  // (logo WEES agora está no topo da coluna vermelha — removido daqui)

  // ===== Footer band — website (mais fino) =====
  doc.setFillColor(COVER_RED.r, COVER_RED.g, COVER_RED.b);
  doc.rect(0, MAIN_AREA_H, PAGE_WIDTH, FOOTER_BAND_H, 'F');
  doc.setTextColor(255, 255, 255);
  setF(doc, 'bold');
  doc.setFontSize(9.5);
  {
    const url = 'weesservicos.com.br';
    const textW = doc.getTextWidth(url);
    const iconR = 1.6;
    const gap = 2;
    const totalW = iconR * 2 + gap + textW;
    const startX = (PAGE_WIDTH - totalW) / 2;
    const iconCx = startX + iconR;
    const bandCenterY = MAIN_AREA_H + FOOTER_BAND_H / 2;
    const iconCy = bandCenterY;
    // Globe vetorial: círculo + linha equador + elipse meridiano
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.25);
    doc.circle(iconCx, iconCy, iconR, 'S');
    doc.line(iconCx - iconR, iconCy, iconCx + iconR, iconCy);
    doc.ellipse(iconCx, iconCy, iconR * 0.55, iconR, 'S');
    // Texto centralizado verticalmente com o ícone
    doc.text(url, iconCx + iconR + gap, bandCenterY, { align: 'left', baseline: 'middle' });
  }

  // Address strip
  doc.setFillColor(255, 255, 255);
  doc.rect(0, MAIN_AREA_H + FOOTER_BAND_H, PAGE_WIDTH, ADDR_BAND_H, 'F');
  doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
  setF(doc, 'normal');
  doc.setFontSize(7);
  {
    const addr = 'Rua Antonio Baiocco, sn - Lote 14 - João Neiva, ES.';
    const tW = doc.getTextWidth(addr);
    const pinW = 2.2;
    const gap2 = 1.6;
    const total = pinW + gap2 + tW;
    const sx = (PAGE_WIDTH - total) / 2;
    const pinCx = sx + pinW / 2;
    const addrCenterY = MAIN_AREA_H + FOOTER_BAND_H + ADDR_BAND_H / 2;
    // Pin: círculo no topo + triângulo apontando para baixo, vermelho
    // Altura total do pin = raio do círculo (0.95) + comprimento até a ponta (2.3) ≈ 3.25
    // Centro vertical do pin (ponto médio entre topo do círculo e ponta) deve ficar em addrCenterY
    const pinTotalH = 0.95 + 2.3;
    const pinTopY = addrCenterY - pinTotalH / 2 + 0.95;
    doc.setFillColor(COVER_RED.r, COVER_RED.g, COVER_RED.b);
    doc.circle(pinCx, pinTopY, 0.95, 'F');
    doc.triangle(
      pinCx - 0.85, pinTopY + 0.55,
      pinCx + 0.85, pinTopY + 0.55,
      pinCx, pinTopY + 2.3,
      'F'
    );
    // Furo branco do pin
    doc.setFillColor(255, 255, 255);
    doc.circle(pinCx, pinTopY, 0.32, 'F');
    // Texto centralizado verticalmente com o pin
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    doc.text(addr, sx + pinW + gap2, addrCenterY, { align: 'left', baseline: 'middle' });
  }
  } // end if (!coverHandled)

  // Hard reset of any state the cover may have left behind (charSpace, font,
  // color). The cover uses letterspacing for stylized titles and runs async
  // image loaders that can interleave with state changes — without this reset
  // every internal page inherits broken kerning.
  doc.setCharSpace(0);

  // ===== CONTENT PAGES =====
  doc.addPage();
  pageCount.count++;
  doc.setCharSpace(0);
  let y = addHeader(doc, data.code, data.revision, headerLogo, pageCount.count);

  // Page-break helper bound to current state
  const pb = (needed: number, currentY: number) =>
    checkPageBreak(doc, currentY, needed, data.code, data.revision, headerLogo, pageCount);

  // Renders a single ContentBlock, parsing any embedded HTML safely.
  const renderBlock = (block: ContentBlock, sectionTitleForDedup: string | null) => {
    const rawText = (block.text || '').trim();
    if (!rawText) return;
    // Defensive: reset kerning at every block start to avoid residual charSpace
    // leaking from cover or previous styling calls.
    doc.setCharSpace(0);

    const looksLikeHtml = /<\/?[a-z][\s\S]*?>/i.test(rawText);

    if (block.type === 'heading') {
      // If the heading text is identical to the section title, skip it.
      // Strict equality only — substring matches incorrectly suppressed valid
      // sub-headings (e.g. "Recomendações" inside "Conclusão e Recomendações").
      if (sectionTitleForDedup) {
        const a = normalizeForCompare(cleanSectionTitle(rawText.replace(/<[^>]+>/g, '')));
        const b = normalizeForCompare(cleanSectionTitle(sectionTitleForDedup));
        if (a && b && a === b) return;
      }
      y = pb(8, y);
      doc.setFontSize(9);
      setF(doc, 'bold');
      doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
      const cleanedHeading = rawText.replace(/<[^>]+>/g, '');
      const lines = doc.splitTextToSize(decodeEntities(cleanedHeading), CONTENT_WIDTH);
      for (const ln of lines) {
        y = pb(5, y);
        doc.text(ln, MARGIN, y + 4);
        y += 5;
      }
      y += 2;
      return;
    }

    if (block.type === 'list') {
      // Build list items from multiple possible inputs:
      //  1. Real <ul>/<ol> HTML → use parsed list items.
      //  2. HTML with <p>...</p> paragraphs (common when AI saves recommendations
      //     as a "list" block but with paragraph markup) → each <p> = one item.
      //  3. Plain text with newlines → each non-empty line = one item.
      let items: TextRun[][] = [];
      if (looksLikeHtml) {
        const parsedAll = htmlToPdfBlocks(rawText);
        const realList = parsedAll.find((b) => b.type === 'list') as
          | { type: 'list'; items: TextRun[][] }
          | undefined;
        if (realList && realList.items.length > 0) {
          items = realList.items;
        } else {
          // Treat each paragraph/heading as an item.
          const paraItems = parsedAll
            .filter((b) => b.type === 'paragraph' || b.type === 'heading')
            .map((b: any) => b.runs as TextRun[])
            .filter((runs) => runsToPlain(runs).trim().length > 0);
          if (paraItems.length > 0) {
            items = paraItems;
          } else {
            items = rawText
              .split(/\n+/)
              .map((t) => decodeEntities(t.replace(/<[^>]+>/g, '')).trim())
              .filter(Boolean)
              .map((t) => [{ text: t }]);
          }
        }
      } else {
        items = rawText.split('\n').filter(Boolean).map((t: string) => [{ text: t }]);
      }

      // Deduplicate identical items inside the same list (defensive).
      const seenItem = new Set<string>();
      items = items.filter((runs) => {
        const key = normalizeForCompare(runsToPlain(runs));
        if (!key) return false;
        if (seenItem.has(key)) return false;
        seenItem.add(key);
        return true;
      });

      for (const itemRuns of items) {
        const bulletX = MARGIN + 2;
        const textX = MARGIN + 6;
        y = pb(5, y);
        doc.setFontSize(9);
        setF(doc, 'normal');
        doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
        doc.text('•', bulletX, y + 4);
        y = drawRichRuns(doc, itemRuns, y, {
          x: textX,
          maxWidth: CONTENT_WIDTH - (textX - MARGIN),
          fontSize: 9,
          lineHeight: 4.5,
          color: COLORS.dark,
          pageBreak: (needed, cy) => pb(needed, cy),
        });
      }
      y += 2;
      return;
    }

    // paragraph (default)
    if (looksLikeHtml) {
      let parsed = htmlToPdfBlocks(rawText);
      if (sectionTitleForDedup) parsed = stripDuplicateHeading(parsed, sectionTitleForDedup);
      parsed = dedupeParsedBlocks(parsed);
      for (const pblock of parsed) {
        if (pblock.type === 'heading') {
          // Match the standalone heading path (block.type === 'heading') for
          // visual consistency: same size (9), bold weight, lineHeight 5,
          // bottom spacing 2. Avoids "Recomendações" looking like a different
          // typeface depending on whether it arrives as <h3> inside a paragraph
          // or as its own block.
          const hSize = pblock.level === 1 ? 10.5 : pblock.level === 2 ? 10 : 9;
          y = pb(7, y);
          doc.setFontSize(hSize);
          setF(doc, 'bold');
          doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
          y = drawRichRuns(doc, pblock.runs, y, {
            x: MARGIN,
            maxWidth: CONTENT_WIDTH,
            fontSize: hSize,
            lineHeight: 5,
            color: COLORS.dark,
            pageBreak: (needed, cy) => pb(needed, cy),
          });
          y += 2;
        } else if (pblock.type === 'paragraph') {
          y = drawRichRuns(doc, pblock.runs, y, {
            x: MARGIN,
            maxWidth: CONTENT_WIDTH,
            fontSize: 9,
            lineHeight: 4.6,
            color: COLORS.dark,
            pageBreak: (needed, cy) => pb(needed, cy),
          });
          y += 1.5;
        } else if (pblock.type === 'list') {
          for (const itemRuns of pblock.items) {
            const bulletX = MARGIN + 2;
            const textX = MARGIN + 6;
            y = pb(5, y);
            doc.setFontSize(9);
            setF(doc, 'normal');
            doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
            doc.text('•', bulletX, y + 4);
            y = drawRichRuns(doc, itemRuns, y, {
              x: textX,
              maxWidth: CONTENT_WIDTH - (textX - MARGIN),
              fontSize: 9,
              lineHeight: 4.5,
              color: COLORS.dark,
              pageBreak: (needed, cy) => pb(needed, cy),
            });
          }
          y += 1.5;
        }
      }
      return;
    }

    // Plain paragraph fallback
    doc.setFontSize(9);
    setF(doc, 'normal');
    doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
    const lines = doc.splitTextToSize(decodeEntities(rawText), CONTENT_WIDTH);
    for (const line of lines) {
      y = pb(5, y);
      doc.text(line, MARGIN, y + 4);
      y += 5;
    }
    y += 2;
  };

  // Render each section
  for (let sIdx = 0; sIdx < data.sections.length; sIdx++) {
    const section = data.sections[sIdx];

    // Section title
    y = pb(14, y);
    doc.setFontSize(11);
    setF(doc, 'bold');
    doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.text(formatSectionTitle(section.title, sIdx), MARGIN, y + 5);
    y += 10;

    // Accent line under section title
    doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN + 60, y);
    y += 5;

    // Defesa em profundidade: deduplica blocks com texto repetido / contido em
    // blocks anteriores da mesma seção (cobre relatórios antigos salvos com
    // duplicação entre conclusion e recommendations).
    const normBlock = (s: string) =>
      (s || '')
        .replace(/<[^>]+>/g, ' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const seenInSection: string[] = [];
    const isDuplicateBlock = (text: string): boolean => {
      const n = normBlock(text);
      if (!n || n.length < 12) return false;
      for (const prev of seenInSection) {
        if (prev === n) return true;
        // Reduzido de 40 para 30: pega contenções mais curtas.
        if (prev.includes(n) && n.length > 30) return true;
        if (n.includes(prev) && prev.length > 30) return true;
      }
      // Bloco "agregador": novo bloco que contém >=70% (em caracteres) da soma
      // dos blocos anteriores → é uma versão re-concatenada (caso clássico do
      // editor que salva conclusão+recomendação separados E juntos em bold).
      if (seenInSection.length >= 2) {
        const joined = seenInSection.join(' ');
        let matched = 0;
        for (const prev of seenInSection) {
          if (prev.length >= 15 && n.includes(prev)) matched += prev.length;
        }
        if (joined.length > 0 && matched / joined.length >= 0.7) return true;
      }
      seenInSection.push(n);
      return false;
    };

    // Content blocks
    for (const block of section.content) {
      if (block.type !== 'heading' && isDuplicateBlock(block.text || '')) {
        continue;
      }
      renderBlock(block, section.title);
    }

    // Photos — strict technical grid (2 cols), zero overlap.
    if (section.photos && section.photos.length > 0) {
      const orderedPhotos = [...section.photos].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
      );
      const { rows, rowHeights } = planPhotoRows(orderedPhotos, MARGIN, CONTENT_WIDTH, 4);

      const MAX_USABLE_H = PAGE_HEIGHT - FOOTER_HEIGHT - MARGIN;
      let labelEmitted = false;

      const emitLabel = () => {
        doc.setFontSize(8);
        setF(doc, 'bold');
        doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b);
        doc.text('REGISTRO FOTOGRÁFICO', MARGIN, y + 4);
        // accent line under label
        doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
        doc.setLineWidth(0.2);
        doc.line(MARGIN, y + 5.5, MARGIN + 36, y + 5.5);
        y += 9;
        labelEmitted = true;
      };

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const rowH = rowHeights[r];
        const captionStrip = row.some((s) => (s.photo.caption || '').trim()) ? 7 : 3;

        const labelH = !labelEmitted ? 10 : 0;
        const needed = labelH + rowH + captionStrip + 4;

        // Hard rule: if it doesn't fit in remaining space, jump page.
        const remaining = MAX_USABLE_H - y;
        if (remaining < needed) {
          y = pb(needed, y);
        }

        if (!labelEmitted) emitLabel();

        // Draw each slot using CONTAIN fit (no cropping, no overflow).
        // Background: light neutral frame so portrait photos don't look floating.
        for (const slot of row) {
          doc.setFillColor(248, 248, 248);
          doc.rect(slot.x, y, slot.w, rowH, 'F');
          doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
          doc.setLineWidth(0.15);
          doc.rect(slot.x, y, slot.w, rowH, 'S');

          const base64 = await loadImageAsBase64(slot.photo.url);
          if (base64) {
            try {
              const dims = await getImageDimensions(base64);
              // CONTAIN: fits inside the slot without cropping or overflow.
              const fit = fitImageToBox(dims.width, dims.height, slot.w - 2, rowH - 2);
              doc.addImage(
                base64,
                'JPEG',
                slot.x + 1 + fit.offsetX,
                y + 1 + fit.offsetY,
                fit.width,
                fit.height,
                undefined,
                'FAST',
              );
            } catch { /* ignore */ }
          }
        }

        // Captions (centered under each slot)
        const capY = y + rowH + 3;
        let anyCaption = false;
        for (const slot of row) {
          const caption = (slot.photo.caption || '').trim();
          if (!caption) continue;
          anyCaption = true;
          doc.setFontSize(6.8);
          setF(doc, 'italic');
          doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b);
          const lines = doc.splitTextToSize(caption, slot.w - 2).slice(0, 2);
          lines.forEach((ln: string, i: number) => {
            doc.text(ln, slot.x + slot.w / 2, capY + i * 3, { align: 'center' });
          });
        }
        y += rowH + (anyCaption ? captionStrip : 3);
      }
    }

    y += 6;
  }

  // Conclusion section (from report-level field) — only if no section already
  // contains the conclusion (avoids duplicating "Conclusão e Recomendações"
  // when the AI/auto generator already created a dedicated section for it).
  const hasConclusionSection = data.sections.some(
    (s) => s.sectionType === 'conclusion' ||
      /concluso|conclusao|recomenda/i.test(
        (s.title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      ),
  );
  if (data.conclusion && data.conclusion.trim() && !hasConclusionSection) {
    y = pb(40, y);
    doc.setFontSize(11);
    setF(doc, 'bold');
    doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.text('CONCLUSÃO E RECOMENDAÇÕES', MARGIN, y + 5);
    y += 10;
    doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN + 60, y);
    y += 5;

    renderBlock({ type: 'paragraph', text: data.conclusion } as ContentBlock, null);
  }

  // Add footer to last page
  addFooter(doc);

  return doc;
}
