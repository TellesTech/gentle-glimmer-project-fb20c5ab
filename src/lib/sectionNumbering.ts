/**
 * Smart section numbering: only adds the auto prefix ("1.", "2.", "3.") when
 * the user hasn't already typed a number at the start of the title.
 *
 * Examples:
 *   formatSectionTitle("Manutenção", 0)        -> "1. Manutenção"
 *   formatSectionTitle("5.1 Manutenção", 2)    -> "5.1 Manutenção"   (no auto prefix)
 *   formatSectionTitle("3. Inspeção", 1)       -> "3. Inspeção"      (no auto prefix)
 *   formatSectionTitle("2.4.1 - Detalhes", 0)  -> "2.4.1 - Detalhes" (no auto prefix)
 *   formatSectionTitle("", 0)                  -> "1. "
 */

/** Strips HTML tags and trims whitespace. */
export function cleanSectionTitle(title: string | null | undefined): string {
  return (title || '').replace(/<[^>]*>/g, '').trim();
}

/**
 * Detects if a title starts with a numeric prefix
 * (e.g. "5", "5.", "5.1", "5.1.", "5.1.2", "5.1.2."), optionally followed by
 * a space, dash, or end of string.
 */
export function hasManualNumberPrefix(title: string | null | undefined): boolean {
  const cleaned = cleanSectionTitle(title);
  return /^\d+(\.\d+)*\.?(\s|-|$)/.test(cleaned);
}

/** Returns the section title with auto-numbering only if the title doesn't already start with a number. */
export function formatSectionTitle(title: string | null | undefined, sectionIndex: number): string {
  const cleaned = cleanSectionTitle(title);
  if (hasManualNumberPrefix(cleaned)) return cleaned;
  return `${sectionIndex + 1}. ${cleaned}`;
}

/**
 * Returns just the prefix to prepend to a title (or empty string if the user already typed one).
 * Useful when the title is rendered separately (e.g. inside an editable component).
 */
export function getSectionNumberPrefix(title: string | null | undefined, sectionIndex: number): string {
  if (hasManualNumberPrefix(title)) return '';
  return `${sectionIndex + 1}. `;
}
