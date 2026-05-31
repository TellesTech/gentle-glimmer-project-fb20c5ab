/**
 * Formata telefone brasileiro automaticamente
 * Suporta fixo (10 dígitos) e celular (11 dígitos)
 */
export function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, '');
  const limited = digits.slice(0, 11);

  if (limited.length === 0) return '';
  if (limited.length <= 2) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  if (limited.length <= 10) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  }
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
}

/**
 * Remove formatação do telefone para salvar no banco
 */
export function unformatPhone(value: string): string {
  return value.replace(/\D/g, '');
}
