/**
 * Cálculos CLT de horas trabalhadas.
 * Turno industrial: 10h de jornada - 1h de almoço = 9h normais (HN).
 * Extras: primeiras 2h = 75%, restante = 100%.
 * Adicional Noturno (ADN): horas entre 22:00 e 05:00.
 */

interface WorkHoursResult {
  normalHours: number;
  compensationHours: number;
  overtime75: number;
  overtime100: number;
  nightBonus: number;
  totalWorked: number;
}

/**
 * Converte string HH:MM para minutos desde meia-noite.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Calcula minutos trabalhados dentro de uma faixa noturna (22:00-05:00).
 */
function calculateNightMinutes(startMin: number, endMin: number): number {
  // Faixa noturna: 22:00 (1320) até 05:00 (300) do dia seguinte
  const NIGHT_START = 22 * 60; // 1320
  const NIGHT_END = 5 * 60;   // 300

  let nightMinutes = 0;

  if (endMin > startMin) {
    // Mesmo dia
    // Noturno antes das 05:00
    if (startMin < NIGHT_END) {
      nightMinutes += Math.min(endMin, NIGHT_END) - startMin;
    }
    // Noturno após 22:00
    if (endMin > NIGHT_START) {
      nightMinutes += endMin - Math.max(startMin, NIGHT_START);
    }
  } else {
    // Cruza meia-noite (ex: 17:00-07:00)
    // Parte 1: startMin até 24:00 (1440)
    if (startMin < 1440) {
      if (startMin < NIGHT_END) {
        nightMinutes += NIGHT_END - startMin;
      }
      if (1440 > NIGHT_START) {
        nightMinutes += 1440 - Math.max(startMin, NIGHT_START);
      }
    }
    // Parte 2: 00:00 até endMin
    if (endMin > 0) {
      if (endMin <= NIGHT_END) {
        nightMinutes += endMin;
      } else {
        nightMinutes += NIGHT_END;
      }
      if (endMin > NIGHT_START) {
        nightMinutes += endMin - NIGHT_START;
      }
    }
  }

  return Math.max(0, nightMinutes);
}

/**
 * Calcula horas de trabalho segundo a CLT para turno industrial.
 * @param startTime - formato "HH:MM"
 * @param endTime - formato "HH:MM"
 * @param lunchMinutes - duração do almoço em minutos (padrão 60)
 */
/**
 * Mescla múltiplos turnos do mesmo colaborador/dia e calcula horas CLT.
 * Ordena por início, mescla sobreposições/consecutivos, desconta 1 almoço.
 */
export function mergeAndCalculateWorkHours(
  shifts: Array<{ start: string; end: string }>
): WorkHoursResult {
  const empty: WorkHoursResult = {
    normalHours: 0, compensationHours: 0, overtime75: 0,
    overtime100: 0, nightBonus: 0, totalWorked: 0,
  };

  const valid = shifts.filter(s => s.start && s.end);
  if (valid.length === 0) return empty;

  // Convert to minute intervals, handling midnight crossing
  const intervals = valid.map(s => {
    const startMin = timeToMinutes(s.start);
    const endMin = timeToMinutes(s.end);
    return { start: startMin, end: endMin <= startMin ? endMin + 1440 : endMin };
  }).sort((a, b) => a.start - b.start);

  // Merge overlapping/consecutive intervals
  const merged: Array<{ start: number; end: number }> = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    if (intervals[i].start <= last.end) {
      last.end = Math.max(last.end, intervals[i].end);
    } else {
      merged.push({ ...intervals[i] });
    }
  }

  // Total bruto
  const totalMinutes = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
  const workedMinutes = Math.max(0, totalMinutes - 60); // 1 almoço
  const workedHours = workedMinutes / 60;

  const HN_LIMIT = 9;
  const EXTRA_75_LIMIT = 2;
  const normalHours = Math.min(workedHours, HN_LIMIT);
  const extraHours = Math.max(0, workedHours - HN_LIMIT);
  const overtime75 = Math.min(extraHours, EXTRA_75_LIMIT);
  const overtime100 = Math.max(0, extraHours - EXTRA_75_LIMIT);

  // ADN sobre intervalos mesclados (normalizar para 0-1440)
  let nightMin = 0;
  for (const iv of merged) {
    const s = iv.start % 1440;
    const e = iv.end % 1440;
    nightMin += calculateNightMinutes(s, e || 1440);
  }

  return {
    normalHours: Math.round(normalHours * 100) / 100,
    compensationHours: 0,
    overtime75: Math.round(overtime75 * 100) / 100,
    overtime100: Math.round(overtime100 * 100) / 100,
    nightBonus: Math.round((nightMin / 60) * 100) / 100,
    totalWorked: Math.round(workedHours * 100) / 100,
  };
}

export function calculateWorkHours(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  lunchMinutes: number = 60
): WorkHoursResult {
  const empty: WorkHoursResult = {
    normalHours: 0,
    compensationHours: 0,
    overtime75: 0,
    overtime100: 0,
    nightBonus: 0,
    totalWorked: 0,
  };

  if (!startTime || !endTime) return empty;

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  // Total de minutos brutos
  let totalMinutes: number;
  if (endMin > startMin) {
    totalMinutes = endMin - startMin;
  } else if (endMin < startMin) {
    // Cruza meia-noite
    totalMinutes = (1440 - startMin) + endMin;
  } else {
    return empty; // Mesma hora = 0
  }

  // Descontar almoço
  const workedMinutes = Math.max(0, totalMinutes - lunchMinutes);
  const workedHours = workedMinutes / 60;

  const HN_LIMIT = 9; // 9h normais (turno 10h - 1h almoço)
  const EXTRA_75_LIMIT = 2; // Primeiras 2h extras = 75%

  const normalHours = Math.min(workedHours, HN_LIMIT);
  const extraHours = Math.max(0, workedHours - HN_LIMIT);
  const overtime75 = Math.min(extraHours, EXTRA_75_LIMIT);
  const overtime100 = Math.max(0, extraHours - EXTRA_75_LIMIT);

  // ADN
  const nightMinVal = calculateNightMinutes(startMin, endMin);
  const nightBonus = nightMinVal / 60;

  return {
    normalHours: Math.round(normalHours * 100) / 100,
    compensationHours: 0,
    overtime75: Math.round(overtime75 * 100) / 100,
    overtime100: Math.round(overtime100 * 100) / 100,
    nightBonus: Math.round(nightBonus * 100) / 100,
    totalWorked: Math.round(workedHours * 100) / 100,
  };
}
