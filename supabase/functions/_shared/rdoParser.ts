// ============================================================================
// Parser determinístico de RDOs recebidos via WhatsApp.
//
// Suporta o FORMATO CANÔNICO OFICIAL (com emojis/asteriscos) e os formatos
// antigos usados pelos grupos ("Data:", "Local:", "Equipe de Trabalho",
// "Registro de Horários", etc.).
//
// Este módulo é puro (sem I/O) para permitir testes automatizados.
// ============================================================================

export interface RdoEfetivoItem {
  nome: string;
  funcao: string | null;
  presente: boolean;
}

export interface RdoDeviation {
  descricao: string;
  tipo: string;
  impacto: string;
  acaoCorretiva: string | null;
}

export interface RdoParsed {
  data: string | null;
  turno: "morning" | "afternoon" | "night" | null;
  atividade: string | null;
  tituloTrabalho: string | null;
  localAtividade: string | null;
  horaInicio: string | null;
  horaFim: string | null;
  radioWees: string | null;
  radioOperacao: string | null;
  numeroOM: string | null;
  tituloOM: string | null;
  pontoAmbulancia: string | null;
  pontoEncontro: string | null;
  horarioChegadaLiberador: string | null;
  horarioLiberacao: string | null;
  horarioRevalidacaoBloqueio: string | null;
  bloqueio: string | null;
  atividades: string[];
  desvios: RdoDeviation[];
  efetivo: RdoEfetivoItem[];
  comentarios: string | null;
  supervisor: string | null;
  responsavelTecnico: string | null;
  /** Campos que vieram de um rótulo explícito — vencem a IA na mesclagem. */
  explicit: string[];
}

// ---------------------------------------------------------------------------
// Normalização de texto
// ---------------------------------------------------------------------------

const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu;

export function stripAccents(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normKey(s: string): string {
  return stripAccents(String(s || ""))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Limpa uma linha: remove emojis, markdown, bullets e separadores. */
export function cleanLine(line: string): string {
  let l = (line || "")
    .replace(/\u00a0/g, " ")
    .replace(EMOJI_RE, " ")
    .replace(/[*_~`]+/g, " ")
    .replace(/[━─—=]{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // remove marcador de lista no início
  l = l.replace(/^(?:[•‣·◦\-–>»]+\s*)+/, "").trim();
  return l;
}

/** Remove numeração "1." / "1)" do início. */
function stripNumbering(line: string): string {
  return line.replace(/^\d{1,2}\s*[.)\-]\s*/, "").trim();
}

export function normalizeMessage(text: string): string[] {
  return String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(cleanLine);
}

// ---------------------------------------------------------------------------
// Valores inválidos / placeholders
// ---------------------------------------------------------------------------

const PLACEHOLDERS = new Set([
  "",
  "-",
  "--",
  "na",
  "n a",
  "n/a",
  "n.a",
  "n.a.",
  "null",
  "nao",
  "nao informado",
  "nao ha",
  "nao houve",
  "nao se aplica",
  "nenhum",
  "nenhuma",
  "sem om",
  "sem desvios",
  "sem ocorrencias",
  "sem interferencia",
  "sem interferencias",
  "0",
  "xx xx xxxx",
  "x",
]);

export function isPlaceholder(v: unknown): boolean {
  const k = normKey(v as string);
  return PLACEHOLDERS.has(k);
}

/** Número da OM: apenas código válido contendo dígitos. */
export function sanitizeOmNumber(value: unknown): string | null {
  let v = String(value ?? "").trim();
  if (!v) return null;
  v = cleanLine(v);
  // corta caso tenha capturado o próximo rótulo na mesma string
  v = v.split(/\s{2,}|[\n]/)[0].trim();
  v = v.replace(/^(?:n[º°o]?\.?\s*(?:da\s*)?)?(?:o\.?\s*m\.?|om)\s*[:\-]?\s*/i, "").trim();
  v = v.replace(/[.,;:]+$/, "").trim();
  if (isPlaceholder(v)) return null;
  if (!/\d/.test(v)) return null;
  // Precisa ser um código: dígitos com separadores opcionais
  if (!/^[\w][\w./\- ]{0,29}$/.test(v)) return null;
  const digits = v.replace(/\D/g, "");
  if (digits.length < 3) return null;
  if (/^0+$/.test(digits)) return null;
  return v.replace(/\s+/g, "");
}

/** Chave de comparação de OM (somente dígitos). */
export function omKey(value: unknown): string | null {
  const s = sanitizeOmNumber(value);
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  return d || null;
}

export function normalizeTime(value: unknown): string | null {
  const raw = cleanLine(String(value ?? ""));
  if (!raw || isPlaceholder(raw)) return null;
  const m = raw.match(/(\d{1,2})\s*(?:[:h.]\s*(\d{1,2}))?\s*(?:h(?:ora?s?)?|hrs?|hs)?/i);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] !== undefined ? parseInt(m[2], 10) : 0;
  if (isNaN(h) || h > 23 || min > 59) return null;
  if (!/\d/.test(raw)) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Extrai período "07:00 às 17:00" de uma linha. */
export function parsePeriod(value: string): { inicio: string | null; fim: string | null } {
  const raw = cleanLine(value);
  const re = /(\d{1,2}\s*(?:[:h.]\s*\d{1,2})?\s*(?:h(?:ora?s?)?|hrs?|hs)?)/gi;
  const parts = raw.match(re)?.map((p) => p.trim()).filter((p) => /\d/.test(p)) || [];
  const times = parts.map(normalizeTime).filter(Boolean) as string[];
  if (times.length >= 2) return { inicio: times[0], fim: times[1] };
  if (times.length === 1) return { inicio: times[0], fim: null };
  return { inicio: null, fim: null };
}

/** Converte DD/MM/YYYY ou DD/MM/YY para YYYY-MM-DD, preservando o ano informado. */
export function parseDateBR(value: string): string | null {
  const m = String(value || "").match(/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{2,4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function inferShift(
  text: string,
  horaInicio: string | null
): "morning" | "afternoon" | "night" | null {
  const k = normKey(text);
  if (/\bnoturn|\bnoite\b/.test(k)) return "night";
  if (/\bdiurn|matutin|\bmanha\b/.test(k)) return "morning";
  if (/vespertin|\btarde\b/.test(k)) return "afternoon";
  if (horaInicio && /^\d{2}:\d{2}$/.test(horaInicio)) {
    const h = parseInt(horaInicio.slice(0, 2), 10);
    if (h >= 18 || h < 6) return "night";
    if (h >= 12) return "afternoon";
    return "morning";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------

type FieldKey =
  | "dataTurno"
  | "atividade"
  | "localAtividade"
  | "horarioTrabalho"
  | "inicio"
  | "termino"
  | "radioWees"
  | "radioOperacao"
  | "tituloOM"
  | "numeroOM"
  | "pontoAmbulancia"
  | "pontoEncontro"
  | "chegadaLiberador"
  | "liberacaoDoc"
  | "revalidacaoBloqueio"
  | "bloqueio"
  | "supervisor"
  | "responsavelTecnico"
  | "turno";

type SectionKey = "atividades" | "desvios" | "efetivo" | "observacoes" | "controleLiberacao" | "ignore";

const FIELD_LABELS: Array<[FieldKey, string[]]> = [
  ["dataTurno", ["data turno", "data e turno", "data", "dia", "data do rdo"]],
  ["turno", ["turno"]],
  ["atividade", ["atividade", "frente", "frente de trabalho", "atividade principal"]],
  [
    "localAtividade",
    [
      "area da atividade",
      "local da atividade",
      "local da obra",
      "local de trabalho",
      "local",
      "area",
      "sub area",
      "subarea",
      "setor",
      "regiao",
      "unidade",
    ],
  ],
  ["horarioTrabalho", ["horario de trabalho", "periodo de trabalho", "horario", "periodo", "jornada"]],
  ["inicio", ["inicio", "hora inicio", "hora de inicio", "inicio da atividade"]],
  ["termino", ["termino", "fim", "hora fim", "hora de termino", "termino da atividade", "saida"]],
  [
    "radioWees",
    ["faixa de radio wees", "faixa de radio  wees", "radio wees", "canal wees", "faixa wees", "wees"],
  ],
  [
    "radioOperacao",
    [
      "faixa de radio operacao",
      "radio operacao",
      "canal operacao",
      "faixa de radio csn",
      "radio csn",
      "canal csn",
      "faixa de radio cliente",
      "faixa de radio da operacao",
    ],
  ],
  ["tituloOM", ["titulo da om obrigatorio", "titulo da om", "titulo om", "descricao da om", "titulo"]],
  [
    "numeroOM",
    [
      "numero da om",
      "numero om",
      "n da om",
      "no da om",
      "n om",
      "no om",
      "om",
      "o m",
      "ordem de manutencao",
      "ordem",
      "n da os",
      "numero da os",
      "os",
      "ordem de servico",
    ],
  ],
  ["pontoAmbulancia", ["ponto de ambulancia", "ambulancia"]],
  ["pontoEncontro", ["ponto de encontro"]],
  [
    "chegadaLiberador",
    [
      "chegada a sala do liberador",
      "chegada na sala do liberador",
      "chegada sala do liberador",
      "chegada ao liberador",
      "chegada liberador",
      "horario de chegada na unidade",
      "horario de chegada",
      "chegada",
    ],
  ],
  [
    "liberacaoDoc",
    [
      "liberacao da documentacao",
      "horario da liberacao da documentacao",
      "liberacao de documentacao",
      "liberacao da atividade",
      "horario da liberacao",
      "horario de contato",
      "horario liberacao",
      "liberacao",
    ],
  ],
  [
    "revalidacaoBloqueio",
    ["revalidacao de bloqueio", "revalidacao do bloqueio", "revalidacao", "horario de revalidacao"],
  ],
  ["bloqueio", ["bloqueio", "execucao de bloqueio", "status bloqueio", "status do bloqueio"]],
  ["supervisor", ["supervisor", "encarregado", "enc", "responsavel", "lider"]],
  ["responsavelTecnico", ["responsavel tecnico", "tecnico responsavel", "rt", "engenheiro", "eng"]],
];

const SECTION_LABELS: Array<[SectionKey, string[]]> = [
  [
    "atividades",
    [
      "atividades executadas",
      "atividades realizadas",
      "atividades desenvolvidas",
      "servicos executados",
      "servicos realizados",
      "trabalhos realizados",
      "realizado no dia",
      "descricao dos servicos",
      "atividades",
    ],
  ],
  [
    "desvios",
    [
      "desvios ocorrencias",
      "desvios e ocorrencias",
      "desvios",
      "ocorrencias",
      "interferencias",
      "interferencia",
      "interrupcoes",
      "problemas",
    ],
  ],
  [
    "efetivo",
    [
      "efetivo do dia",
      "efetivo",
      "equipe de trabalho",
      "equipe do dia",
      "equipe",
      "mao de obra",
      "colaboradores",
      "colaboradores presentes",
      "pessoal",
      "funcionarios",
      "profissionais",
      "time",
    ],
  ],
  ["observacoes", ["observacoes", "observacao", "obs", "comentarios", "consideracoes"]],
  ["controleLiberacao", ["controle de liberacao", "registro de horarios", "controle de liberacoes"]],
  ["ignore", ["fotos abaixo", "fotos", "segue fotos", "fotos anexas", "relatorio diario de obra rdo", "rdo"]],
];

function matchLabel(labelText: string): { field?: FieldKey; section?: SectionKey } | null {
  const k = normKey(labelText);
  if (!k) return null;
  for (const [section, labels] of SECTION_LABELS) {
    if (labels.includes(k)) return { section };
  }
  for (const [field, labels] of FIELD_LABELS) {
    if (labels.includes(k)) return { field };
  }
  return null;
}

/** Uma linha "Rótulo: valor" — devolve rótulo/valor quando o rótulo é conhecido. */
function splitLabeled(line: string): { label: string; value: string; match: { field?: FieldKey; section?: SectionKey } } | null {
  const idx = line.indexOf(":");
  if (idx > 0) {
    const label = line.slice(0, idx);
    const value = line.slice(idx + 1).trim();
    const m = matchLabel(label);
    if (m) return { label, value, match: m };
  }
  // rótulo sem dois-pontos (ex.: "Atividades Executadas")
  const m2 = matchLabel(line);
  if (m2) return { label: line, value: "", match: m2 };
  return null;
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

const IGNORE_LINE_RE = /^(fotos?\b|segue[m]? fotos?|📷)/i;

export function parseRdoDeterministic(text: string): RdoParsed {
  const lines = normalizeMessage(text);
  const out: RdoParsed = {
    data: null,
    turno: null,
    atividade: null,
    tituloTrabalho: null,
    localAtividade: null,
    horaInicio: null,
    horaFim: null,
    radioWees: null,
    radioOperacao: null,
    numeroOM: null,
    tituloOM: null,
    pontoAmbulancia: null,
    pontoEncontro: null,
    horarioChegadaLiberador: null,
    horarioLiberacao: null,
    horarioRevalidacaoBloqueio: null,
    bloqueio: null,
    atividades: [],
    desvios: [],
    efetivo: [],
    comentarios: null,
    supervisor: null,
    responsavelTecnico: null,
    explicit: [],
  };

  const explicit = new Set<string>();
  const sectionBuffers: Record<string, string[]> = {
    atividades: [],
    desvios: [],
    efetivo: [],
    observacoes: [],
  };

  let currentSection: "atividades" | "desvios" | "efetivo" | "observacoes" | null = null;
  let pendingField: FieldKey | null = null;
  const rawFields: Partial<Record<FieldKey, string>> = {};
  /** Rótulos de campo presentes na mensagem, mesmo com valor em branco. */
  const labelSeen = new Set<FieldKey>();
  /** Cabeçalhos de seção presentes, mesmo sem itens. */
  const sectionSeen = new Set<SectionKey>();

  const setField = (field: FieldKey, value: string) => {
    const v = cleanLine(value);
    if (!v) return;
    if (rawFields[field] === undefined) rawFields[field] = v;
  };

  for (const line of lines) {
    if (!line) {
      // Linha vazia NÃO descarta o rótulo pendente: o valor pode vir depois.
      continue;
    }

    const labeled = splitLabeled(line);

    if (labeled) {
      pendingField = null;
      if (labeled.match.section) {
        const sec = labeled.match.section;
        if (sec === "ignore") {
          currentSection = null;
          continue;
        }
        if (sec === "controleLiberacao") {
          currentSection = null;
          continue;
        }
        currentSection = sec;
        sectionSeen.add(sec);
        if (labeled.value && !isPlaceholder(labeled.value)) {
          sectionBuffers[sec].push(labeled.value);
        }
        continue;
      }
      const field = labeled.match.field!;
      currentSection = null;
      labelSeen.add(field);
      if (labeled.value) {
        setField(field, labeled.value);
      } else {
        pendingField = field;
      }
      continue;
    }

    if (IGNORE_LINE_RE.test(line)) {
      currentSection = null;
      pendingField = null;
      continue;
    }

    if (pendingField) {
      setField(pendingField, line);
      pendingField = null;
      continue;
    }

    if (currentSection) {
      sectionBuffers[currentSection].push(line);
    }
  }

  // ---- Data / turno --------------------------------------------------------
  const dataRaw = rawFields.dataTurno || "";
  if (labelSeen.has("dataTurno")) explicit.add("data");
  if (dataRaw) {
    const d = parseDateBR(dataRaw);
    if (d) {
      out.data = d;
      explicit.add("data");
    }
  }
  if (!out.data) {
    for (const line of lines) {
      const d = parseDateBR(line);
      if (d) {
        out.data = d;
        break;
      }
    }
  }

  // ---- Horários ------------------------------------------------------------
  if (labelSeen.has("horarioTrabalho") || labelSeen.has("inicio")) explicit.add("horaInicio");
  if (labelSeen.has("horarioTrabalho") || labelSeen.has("termino")) explicit.add("horaFim");
  if (rawFields.horarioTrabalho) {
    const { inicio, fim } = parsePeriod(rawFields.horarioTrabalho);
    if (inicio) {
      out.horaInicio = inicio;
      explicit.add("horaInicio");
    }
    if (fim) {
      out.horaFim = fim;
      explicit.add("horaFim");
    }
  }
  if (rawFields.inicio) {
    const t = normalizeTime(rawFields.inicio);
    if (t) {
      out.horaInicio = t;
      explicit.add("horaInicio");
    }
  }
  if (rawFields.termino) {
    const t = normalizeTime(rawFields.termino);
    if (t) {
      out.horaFim = t;
      explicit.add("horaFim");
    }
  }

  const turnoSource = `${rawFields.dataTurno || ""} ${rawFields.turno || ""}`;
  const shift = inferShift(turnoSource, out.horaInicio) || inferShift(lines.slice(0, 4).join(" "), out.horaInicio);
  if (shift) {
    out.turno = shift;
    explicit.add("turno");
  }

  // ---- Campos simples ------------------------------------------------------
  const simple: Array<[FieldKey, keyof RdoParsed]> = [
    ["atividade", "atividade"],
    ["localAtividade", "localAtividade"],
    ["radioWees", "radioWees"],
    ["radioOperacao", "radioOperacao"],
    ["tituloOM", "tituloOM"],
    ["pontoAmbulancia", "pontoAmbulancia"],
    ["pontoEncontro", "pontoEncontro"],
    ["bloqueio", "bloqueio"],
    ["supervisor", "supervisor"],
    ["responsavelTecnico", "responsavelTecnico"],
  ];
  for (const [src, dst] of simple) {
    const v = rawFields[src];
    if (labelSeen.has(src)) explicit.add(dst as string);
    if (v && !isPlaceholder(v)) {
      (out as any)[dst] = v;
    }
  }
  if (out.atividade) out.tituloTrabalho = out.atividade;
  if (explicit.has("atividade")) explicit.add("tituloTrabalho");

  // ---- OM ------------------------------------------------------------------
  const om = sanitizeOmNumber(rawFields.numeroOM);
  out.numeroOM = om;
  if (labelSeen.has("numeroOM") || rawFields.numeroOM !== undefined) explicit.add("numeroOM");

  // ---- Controle de liberação ----------------------------------------------
  const chegada = normalizeTime(rawFields.chegadaLiberador || "");
  if (labelSeen.has("chegadaLiberador")) explicit.add("horarioChegadaLiberador");
  if (labelSeen.has("liberacaoDoc")) explicit.add("horarioLiberacao");
  if (labelSeen.has("revalidacaoBloqueio")) explicit.add("horarioRevalidacaoBloqueio");
  if (chegada) {
    out.horarioChegadaLiberador = chegada;
    explicit.add("horarioChegadaLiberador");
  }
  const liberacao = normalizeTime(rawFields.liberacaoDoc || "");
  if (liberacao) {
    out.horarioLiberacao = liberacao;
    explicit.add("horarioLiberacao");
  }
  const reval = normalizeTime(rawFields.revalidacaoBloqueio || "");
  if (reval) {
    out.horarioRevalidacaoBloqueio = reval;
    explicit.add("horarioRevalidacaoBloqueio");
  }

  // ---- Seções --------------------------------------------------------------
  out.atividades = cleanListItems(sectionBuffers.atividades);
  if (sectionBuffers.atividades.length || sectionSeen.has("atividades")) explicit.add("atividades");

  const desviosItems = cleanListItems(sectionBuffers.desvios);
  out.desvios = desviosItems.map((d) => ({
    descricao: d,
    tipo: "other",
    impacto: "medium",
    acaoCorretiva: null,
  }));
  if (sectionBuffers.desvios.length || sectionSeen.has("desvios")) explicit.add("desvios");

  out.efetivo = parseEfetivo(sectionBuffers.efetivo);
  if (sectionBuffers.efetivo.length || sectionSeen.has("efetivo")) explicit.add("efetivo");

  const obs = cleanListItems(sectionBuffers.observacoes).join(" ");
  if (obs) {
    out.comentarios = obs;
    explicit.add("comentarios");
  } else if (sectionBuffers.observacoes.length || sectionSeen.has("observacoes")) {
    explicit.add("comentarios");
  }

  out.explicit = Array.from(explicit);
  return out;
}

function cleanListItems(raw: string[]): string[] {
  const items: string[] = [];
  for (const r of raw) {
    const l = stripNumbering(cleanLine(r));
    if (!l) continue;
    if (isPlaceholder(l)) continue;
    if (IGNORE_LINE_RE.test(l)) continue;
    items.push(l);
  }
  return items;
}

const FUNCTION_HINTS = /\b(mec|sold|cald|pintor|sup|enc|tst|elet|eng|lider|meio oficial|n1|n2|n3)\b/i;

function parseEfetivo(raw: string[]): RdoEfetivoItem[] {
  const out: RdoEfetivoItem[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const original = r;
    let l = stripNumbering(cleanLine(r));
    if (!l || isPlaceholder(l)) continue;
    if (IGNORE_LINE_RE.test(l)) continue;
    // Presença
    let presente = true;
    if (/[❌✖✗]/u.test(original)) presente = false;

    let funcao: string | null = null;
    // "Função - Nome" / "Nome - Função" / "Nome (Função)"
    const paren = l.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (paren) {
      l = paren[1].trim();
      funcao = paren[2].trim();
    } else if (l.includes(" - ") || l.includes(" / ")) {
      const [a, b] = l.split(/\s+[-/]\s+/);
      if (a && b) {
        if (FUNCTION_HINTS.test(a) && !FUNCTION_HINTS.test(b)) {
          funcao = a.trim();
          l = b.trim();
        } else {
          l = a.trim();
          funcao = b.trim();
        }
      }
    }
    const nome = l.replace(/[.:;,]+$/, "").trim();
    if (!nome || nome.length < 2) continue;
    if (/^\d+$/.test(nome)) continue;
    const key = normKey(nome);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ nome, funcao: funcao || null, presente });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mesclagem determinístico + IA
// ---------------------------------------------------------------------------

const AI_ONLY_KEYS = [
  "data",
  "turno",
  "localAtividade",
  "horaInicio",
  "horaFim",
  "radioWees",
  "radioOperacao",
  "numeroOM",
  "tituloOM",
  "tituloTrabalho",
  "pontoAmbulancia",
  "pontoEncontro",
  "horarioChegadaLiberador",
  "horarioLiberacao",
  "horarioRevalidacaoBloqueio",
  "bloqueio",
  "atividades",
  "desvios",
  "efetivo",
  "comentarios",
  "supervisor",
  "responsavelTecnico",
];

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

/**
 * Mescla o resultado da IA com o determinístico.
 * Valores determinísticos vindos de rótulos explícitos SEMPRE vencem.
 */
export function mergeParsed(det: RdoParsed, ai: Record<string, any> | null | undefined): Record<string, any> {
  const aiData = ai || {};
  const explicit = new Set(det.explicit);
  const merged: Record<string, any> = { ...aiData };

  for (const key of AI_ONLY_KEYS) {
    const detValue = (det as any)[key];
    if (explicit.has(key)) {
      // Rótulo/cabeçalho explícito SEMPRE vence a IA, inclusive quando o valor
      // determinístico é null, "" ou [] (campo rotulado deixado em branco).
      merged[key] = detValue;
      continue;
    }
    if (isEmptyValue(merged[key]) && !isEmptyValue(detValue)) {
      merged[key] = detValue;
    }
  }

  // Saneamentos finais
  merged.numeroOM = sanitizeOmNumber(merged.numeroOM);
  merged.atividade = explicit.has("atividade")
    ? det.atividade
    : det.atividade || merged.atividade || null;
  if (!merged.tituloTrabalho) merged.tituloTrabalho = det.tituloTrabalho || det.atividade || null;

  // tituloOM nunca pode ser substituído pelo local
  if (merged.tituloOM && merged.localAtividade && normKey(merged.tituloOM) === normKey(merged.localAtividade) && !det.explicit.includes("tituloOM")) {
    merged.tituloOM = null;
  }
  if (isPlaceholder(merged.tituloOM)) merged.tituloOM = null;
  if (isPlaceholder(merged.localAtividade)) merged.localAtividade = null;
  if (isPlaceholder(merged.comentarios)) merged.comentarios = null;

  merged.atividades = (merged.atividades || []).filter(
    (a: any) => !isPlaceholder(typeof a === "string" ? a : a?.descricao || a?.description)
  );
  merged.desvios = (merged.desvios || []).filter(
    (d: any) => !isPlaceholder(typeof d === "string" ? d : d?.descricao || d?.description)
  );
  merged.efetivo = (merged.efetivo || []).filter((e: any) => {
    const nome = typeof e === "string" ? e : e?.nome;
    return nome && !isPlaceholder(nome);
  });

  merged.turno = merged.turno || inferShift("", merged.horaInicio) || "morning";
  merged.explicit = det.explicit;
  return merged;
}

// ---------------------------------------------------------------------------
// Roteamento de projeto / atividade
// ---------------------------------------------------------------------------

const GENERIC_WORDS = new Set([
  "limpeza",
  "montagem",
  "linha",
  "atividade",
  "atividades",
  "trabalho",
  "servico",
  "servicos",
  "manutencao",
  "obra",
  "rdo",
  "geral",
  "area",
  "local",
  "diario",
  "reparo",
  "inspecao",
  "pintura",
  "vida",
  "com",
  "para",
  "das",
  "dos",
  "de",
  "da",
  "do",
  "e",
  "em",
  "no",
  "na",
  "om",
]);

export interface RoutableProject {
  id: string;
  name: string;
  code?: string | null;
  contract_number?: string | null;
}

/** Extrai a OM presente no nome padronizado "OM 123 — Título". */
export function projectOmKey(name: string): string | null {
  const m = String(name || "").match(/^\s*OM\s*[:\-]?\s*([\w./-]+)/i);
  return m ? omKey(m[1]) : null;
}

/** Título normalizado do projeto (sem prefixo de OM). */
export function projectTitleKey(name: string): string {
  return normKey(String(name || "").replace(/^\s*OM\s*[:\-]?\s*[\w./-]+\s*[—\-–]\s*/i, ""));
}

export function significantTokens(s: string): string[] {
  return normKey(s)
    .split(" ")
    .filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
}

export interface RouteInput {
  omNumber: string | null;
  omTitle: string | null;
  projects: RoutableProject[];
  /** map projectId -> conjunto de OMs já usadas em reports desse projeto */
  projectOmNumbers?: Record<string, string[]>;
}

export interface RouteResult {
  projectId: string | null;
  reason: string;
}

/**
 * Escolhe a atividade correta para o RDO.
 * Prioridade: OM em reports → OM no nome do projeto → título forte.
 * Nunca roteia por uma única palavra genérica.
 */
export function routeProject(input: RouteInput): RouteResult {
  const { projects } = input;
  const om = omKey(input.omNumber);

  if (om) {
    // 1. OM já registrada em relatórios do projeto
    for (const [pid, oms] of Object.entries(input.projectOmNumbers || {})) {
      if (oms.some((o) => omKey(o) === om) && projects.some((p) => p.id === pid)) {
        return { projectId: pid, reason: "om_in_reports" };
      }
    }
    // 2. OM no nome padronizado do projeto
    for (const p of projects) {
      if (projectOmKey(p.name) === om) return { projectId: p.id, reason: "om_in_project_name" };
      if (p.code && omKey(p.code) === om) return { projectId: p.id, reason: "om_in_project_code" };
    }
    // OM explícita e diferente de tudo → nova atividade
    return { projectId: null, reason: "om_not_found" };
  }

  // 3. Título da OM com correspondência forte
  const title = input.omTitle;
  if (title) {
    const tKey = normKey(title);
    for (const p of projects) {
      if (projectTitleKey(p.name) === tKey) return { projectId: p.id, reason: "title_exact" };
    }
    const tTokens = significantTokens(title);
    if (tTokens.length >= 2) {
      let best: { id: string; score: number } | null = null;
      for (const p of projects) {
        const pTokens = significantTokens(projectTitleKey(p.name));
        if (!pTokens.length) continue;
        const inter = tTokens.filter((t) => pTokens.includes(t)).length;
        const score = inter / Math.max(tTokens.length, pTokens.length);
        if (score >= 0.7 && (!best || score > best.score)) best = { id: p.id, score };
      }
      if (best) return { projectId: best.id, reason: "title_strong" };
    }
    return { projectId: null, reason: "title_no_match" };
  }

  // 4. Sem OM e sem título: só usa quando há exatamente uma atividade ativa
  if (projects.length === 1) return { projectId: projects[0].id, reason: "single_project" };
  return { projectId: null, reason: "ambiguous" };
}

/** Nome padronizado da atividade. */
export function buildProjectName(omNumber: string | null, title: string | null): string | null {
  const om = sanitizeOmNumber(omNumber);
  const t = cleanLine(String(title || ""));
  const validTitle = t && !isPlaceholder(t) && !matchLabel(t) && !/^\d{1,2}:\d{2}$/.test(t) ? t : "";
  if (om && validTitle) return `OM ${om} — ${validTitle}`;
  if (om) return `OM ${om}`;
  if (validTitle) return validTitle;
  return null;
}