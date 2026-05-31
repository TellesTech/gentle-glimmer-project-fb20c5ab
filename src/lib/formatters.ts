import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formatar data para exibição brasileira (dd/MM/yyyy)
 */
export const formatDateBR = (date: Date | string | null | undefined): string => {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '-';
  }
};

/**
 * Formatar data com hora (dd/MM/yyyy às HH:mm)
 */
export const formatDateTimeBR = (date: Date | string | null | undefined): string => {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '-';
  }
};

/**
 * Formatar data curta (dd/MM)
 */
export const formatDateShortBR = (date: Date | string | null | undefined): string => {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'dd/MM', { locale: ptBR });
  } catch {
    return '-';
  }
};

/**
 * Formatar data descritiva (dd 'de' MMM, yyyy)
 */
export const formatDateDescBR = (date: Date | string | null | undefined): string => {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, "dd 'de' MMM, yyyy", { locale: ptBR });
  } catch {
    return '-';
  }
};

/**
 * Formatar número com separador de milhares brasileiro (1.234.567)
 */
export const formatNumberBR = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0';
  return value.toLocaleString('pt-BR');
};

/**
 * Formatar número com casas decimais (1.234,56)
 */
export const formatDecimalBR = (value: number | null | undefined, decimals = 2): string => {
  if (value === null || value === undefined) return '0,00';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Formatar porcentagem (75,5%)
 */
export const formatPercentBR = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0%';
  return `${value.toLocaleString('pt-BR')}%`;
};

/**
 * Formatar número do RDO sequencial (3 dígitos)
 */
export const formatRdoNumber = (rdoNumber: number | null | undefined): string => {
  if (!rdoNumber || rdoNumber < 1) return '001';
  return rdoNumber.toString().padStart(3, '0');
};

/**
 * Formatar nomenclatura do RDO
 * Formato: [Fábrica] - RDO Nº XXX - dd/MM/yyyy
 */
export const formatRdoName = (
  companyName: string | null | undefined,
  date: Date | string,
  rdoNumber?: number | string | null,
  options?: {
    includeCompany?: boolean;
    forFileName?: boolean;
    forFileNameReadable?: boolean;
  }
): string => {
  const formattedRdoNumber = typeof rdoNumber === 'number' 
    ? formatRdoNumber(rdoNumber)
    : (rdoNumber || '001');
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const formattedDate = format(dateObj, 'dd/MM/yyyy', { locale: ptBR });
  const company = companyName || 'Empresa';

  // New readable format: "RDO - 034 - Suzano - 03-01-2026"
  if (options?.forFileNameReadable) {
    const fileDate = format(dateObj, 'dd-MM-yyyy', { locale: ptBR });
    return `RDO - ${formattedRdoNumber} - ${company} - ${fileDate}`;
  }

  if (options?.forFileName) {
    const fileDate = format(dateObj, 'ddMMyyyy', { locale: ptBR });
    return `${company.replace(/\s+/g, '-')}-RDO-${formattedRdoNumber}-${fileDate}`;
  }

  if (options?.includeCompany) {
    return `${company} - RDO Nº ${formattedRdoNumber} - ${formattedDate}`;
  }

  return `RDO Nº ${formattedRdoNumber} - ${formattedDate}`;
};

/**
 * Converter INTERVAL (HH:MM:SS ou HH:MM) para minutos
 */
export const parseIntervalToMinutes = (interval: string | null | undefined): number => {
  if (!interval) return 0;
  const parts = interval.toString().split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return hours * 60 + minutes;
};

/**
 * Formatar minutos para HH:MM
 */
export const formatMinutesToHours = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};
