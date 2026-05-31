import type { ContentBlock } from '@/components/service-reports/SectionEditor';

const stripHtml = (s: string): string =>
  (s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Removes consecutive blocks with the same plain-text content (and same type)
 * — these are usually leftover artifacts of an editor sync loop that
 * duplicated paragraphs while the user was applying formatting.
 *
 * Only deduplicates when the plain text is meaningful (>= 30 chars) so we
 * never collapse intentional repetition like short list items or headings.
 */
export function dedupeContentBlocks(blocks: ContentBlock[]): ContentBlock[] {
  if (!Array.isArray(blocks)) return blocks;

  // First pass: strip leading "Estado em DD/MM/YYYY" / "Atualizado em ..." prefixes
  // that were injected at the start of section paragraphs by the AI.
  const STATE_PREFIX = /^\s*(?:<p[^>]*>)?\s*(?:Estado|Atualizado|Status|Data)\s+em\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*(?:<br\s*\/?>|\s)+/i;
  const cleaned = blocks.map((block, idx) => {
    if (!block || typeof block.text !== 'string') return block;
    if (idx !== 0 && block.type !== 'paragraph') return block;
    if (!STATE_PREFIX.test(block.text)) return block;
    return { ...block, text: block.text.replace(STATE_PREFIX, '').trimStart() };
  });

  if (cleaned.length < 2) return cleaned;

  const out: ContentBlock[] = [];
  let prevKey = '';
  for (const block of cleaned) {
    const plain = stripHtml(block.text || '');
    const key = `${block.type}::${plain}`;
    if (plain.length >= 30 && key === prevKey) {
      continue;
    }
    out.push(block);
    prevKey = key;
  }
  return out;
}
