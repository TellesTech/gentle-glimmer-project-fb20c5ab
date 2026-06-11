import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CORRECTION_KEYWORDS = [
  "corrigindo", "retificando", "correção", "correcao",
  "corrigir", "retificar", "ajuste", "ajustando",
];

const RDO_INDICATORS = [
  "data:", "dia:", "equipe:", "atividade", "efetivo", "turno:", "local:",
  "os:", "ordem de servico", "ordem de serviço", "titulo", "título",
  "faixa de radio", "faixa de rádio", "clima:", "tempo:",
  "relatório diário", "relatório diario", "relatorio diario", "rdo",
  "periodo de trabalho", "período de trabalho", "ponto de encontro",
  "ponto de ambulancia", "ponto de ambulância", "desvio", "bloqueio",
  "interferencia", "interferência", "frentes de servico", "frentes de serviço",
  "hora inicio", "hora início", "hora fim",
];

function normalizeForDetection(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}|\u{2600}-\u{27BF}|\u{FE00}-\u{FEFF}|\u{1F900}-\u{1F9FF}|\u{200D}|\u{20E3}|\u{E0020}-\u{E007F}]/gu, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+:/g, ':')
    .toLowerCase();
}

function isRdoMessage(text: string): boolean {
  const normalized = normalizeForDetection(text);
  const matches = RDO_INDICATORS.filter((ind) => normalized.includes(ind)).length;
  // Standard detection: 2+ indicators
  if (matches >= 2) return true;
  // Fallback: long messages (>200 chars) with at least 1 indicator and RDO-related keyword
  if (text.length > 200 && matches >= 1 && (normalized.includes("relatório") || normalized.includes("relatorio") || normalized.includes("rdo") || normalized.includes("efetivo"))) return true;
  return false;
}

function isCorrectionMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return CORRECTION_KEYWORDS.some((kw) => lower.includes(kw));
}

// Damerau-Levenshtein distance: counts adjacent transpositions as 1 op (e.g. "rhalf" vs "ralfh" = 1)
function damerauLevenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

// Strip accents/diacritics for accent-insensitive matching
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Job/role stop-words (cargos e níveis) que aparecem grudados no nome no WhatsApp.
// Removidos antes da comparação para isolar apenas o nome próprio.
const FUNCTION_STOPWORDS = new Set<string>([
  "soldador", "soldadora", "sold",
  "pintor", "pintora",
  "mecanico", "mecanica", "mec",
  "caldeireiro", "cald",
  "ajudante", "auxiliar", "aux",
  "supervisor", "supervisora", "sup",
  "oficial", "meio",
  "encarregado", "encarregada",
  "lider", "liderado",
  "tecnico", "tecnica",
  "eletricista",
  "serralheiro", "serralheira",
  "montador", "montadora",
  "escalador", "escaladora", "alpinista",
  "inspetor", "inspetora",
  "almoxarife",
  "operador", "operadora",
  "motorista",
  "convencional",
  "junior", "jr", "senior", "sr",
  "n1", "n2", "n3", "i", "ii", "iii",
  "obra", "seguranca", "soldagem", "pintura",
  "de", "do", "da", "dos", "das",
]);

// Normalize a name: lowercase, accent-stripped, single spaces, strip leading numbering ("1.", "2)", "-")
function normalizeName(s: string): string {
  return stripAccents((s || "").toLowerCase())
    .replace(/^\s*\d+[\.\)\-:]\s*/, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Remove tokens que são cargos/níveis (FUNCTION_STOPWORDS), preservando apenas nome próprio
function stripFunctionTokens(normalized: string): string {
  return normalized
    .split(" ")
    .filter((tok) => tok.length > 0 && !FUNCTION_STOPWORDS.has(tok))
    .join(" ")
    .trim();
}

// Match a parsed name against registered profiles.
// Retorna null sempre que houver ambiguidade ou baixa confiança — preferimos não casar a casar errado.
function matchCollaborator(
  parsedName: string,
  profiles: Array<{ id: string; name: string | null; job_title: string | null }>,
  preferredIds?: Set<string>
): { id: string; name: string | null; job_title: string | null } | null {
  if (!parsedName || typeof parsedName !== "string") return null;

  const rawNormalized = normalizeName(parsedName);
  // Remove cargos antes de comparar — "James soldador" → "james"
  const normalized = stripFunctionTokens(rawNormalized) || rawNormalized;
  if (!normalized) {
    console.log(`[NAME_MATCH] empty after normalize raw="${parsedName}"`);
    return null;
  }

  const parts = normalized.split(" ").filter(Boolean);
  const firstName = parts[0];
  const secondName = parts[1];

  type P = { id: string; name: string | null; job_title: string | null };
  // Para os perfis cadastrados também removemos eventuais sufixos de cargo
  const norm = (p: P) => stripFunctionTokens(normalizeName(p.name || ""));
  const isPreferred = (p: P) => (preferredIds?.has(p.id) ? 0 : 1);

  // 1. Exact full name (accent-insensitive)
  const exactMatches = profiles.filter((p) => norm(p) === normalized);
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) {
    // Empate: só aceitamos se houver exatamente 1 preferido (do site/projeto)
    const preferred = exactMatches.filter((p) => isPreferred(p) === 0);
    if (preferred.length === 1) return preferred[0];
    console.log(`[NAME_MATCH] ambiguous_exact name="${parsedName}" candidates=${exactMatches.map(p => p.name).join("|")}`);
    return null;
  }

  // 2. Primeiro + segundo nome (acento-insensível)
  if (secondName) {
    const twoMatches = profiles.filter((p) => {
      const np = norm(p).split(" ");
      return np[0] === firstName && np[1] === secondName;
    });
    if (twoMatches.length === 1) return twoMatches[0];
    if (twoMatches.length > 1) {
      const preferred = twoMatches.filter((p) => isPreferred(p) === 0);
      if (preferred.length === 1) return preferred[0];
      console.log(`[NAME_MATCH] ambiguous_two name="${parsedName}" candidates=${twoMatches.map(p => p.name).join("|")}`);
      return null;
    }
  }

  // 3. Fuzzy do primeiro nome com Damerau-Levenshtein.
  // Limiar relativo: dist <= max(1, floor(len * 0.25)) para evitar matches frouxos.
  const maxDist = Math.max(1, Math.floor(firstName.length * 0.25));
  let bestDist = Number.POSITIVE_INFINITY;
  let candidates: P[] = [];
  for (const p of profiles) {
    const pFull = norm(p);
    const pFirst = pFull.split(" ")[0];
    if (!pFirst) continue;
    
    const dist = damerauLevenshtein(firstName, pFirst);
    if (dist > maxDist) continue;

    // Regra de Gênero: bloquear matches que diferem apenas por sufixo de gênero (a, o, e)
    // Ex: "Emanuel" (7) -> "Emanuela" (8) = dist 1. Mas é provável erro de gênero.
    const l1 = firstName.length;
    const l2 = pFirst.length;
    const isVowelSuffix = (c: string) => ["a", "o", "e"].includes(c.toLowerCase());
    const last1 = firstName[l1 - 1];
    const last2 = pFirst[l2 - 1];

    let blockGender = false;
    if (Math.abs(l1 - l2) === 1 && dist === 1) {
      const shorter = l1 < l2 ? firstName : pFirst;
      const longer = l1 < l2 ? pFirst : firstName;
      if (longer.startsWith(shorter) && isVowelSuffix(longer[longer.length - 1])) {
        blockGender = true;
      }
    } else if (l1 === l2 && dist === 1) {
      // Caso Paulo vs Paula: mesmo len, dist 1, última letra troca o/a
      if (firstName.slice(0, -1) === pFirst.slice(0, -1) && isVowelSuffix(last1) && isVowelSuffix(last2)) {
        blockGender = true;
      }
    }

    if (blockGender) {
      console.log(`[NAME_MATCH] gender_suffix_block input="${firstName}" candidate="${pFirst}"`);
      continue;
    }

    if (dist < bestDist) {
      bestDist = dist;
      candidates = [p];
    } else if (dist === bestDist) {
      candidates.push(p);
    }
  }

  if (candidates.length === 0) {
    console.log(`[NAME_MATCH] unresolved name="${parsedName}" normalized="${normalized}" reason=no_candidates`);
    return null;
  }

  // Validação de sobrenome quando o input tem 2+ palavras:
  // exigir que o sobrenome do perfil também combine (Damerau-Levenshtein <= 2)
  if (secondName) {
    const validated = candidates.filter((p) => {
      const pParts = norm(p).split(" ");
      if (pParts.length < 2) return false;
      // Tenta casar o segundo token do parsed contra qualquer token do perfil (>= 1ª posição)
      const pRest = pParts.slice(1);
      return pRest.some((pTok) => damerauLevenshtein(secondName, pTok) <= 2);
    });
    if (validated.length === 0) {
      console.log(`[NAME_MATCH] unresolved name="${parsedName}" reason=surname_mismatch candidates=${candidates.map(p => p.name).join("|")}`);
      return null;
    }
    candidates = validated;
  }

  // Empate sem desempate semântico → não casar (preferimos NULL a errar)
  if (candidates.length > 1) {
    // Última tentativa: 1 único preferido (do site/projeto deste RDO)
    const preferred = candidates.filter((p) => isPreferred(p) === 0);
    if (preferred.length === 1) {
      console.log(`[NAME_MATCH] tie_broken_by_preferred name="${parsedName}" matched="${preferred[0].name}"`);
      return preferred[0];
    }
    console.log(`[NAME_MATCH] ambiguous_fuzzy name="${parsedName}" dist=${bestDist} candidates=${candidates.map(p => p.name).join("|")}`);
    return null;
  }

  console.log(`[NAME_MATCH] matched name="${parsedName}" -> "${candidates[0].name}" dist=${bestDist}`);
  return candidates[0];
}

const UAZAPI_BASE_URL = "https://chatwees.uazapi.com";

async function attachPendingPhotos(
  supabase: any,
  groupId: string | null,
  senderPhone: string | null,
  reportId: string,
  rdoCode: string | number,
  uazapiToken: string | null
) {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    let query = supabase
      .from("whatsapp_rdo_logs")
      .select("id, raw_payload")
      .eq("status", "pending_photo")
      .gt("created_at", fiveMinAgo);

    if (groupId) {
      query = query.eq("group_id", groupId);
    } else if (senderPhone) {
      query = query.eq("sender_phone", senderPhone);
    } else {
      return;
    }

    const { data: pendingPhotos } = await query.order("created_at", { ascending: true });
    if (!pendingPhotos?.length) return;

    console.log(`Found ${pendingPhotos.length} pending photos to attach to RDO #${rdoCode}`);
    let attachedCount = 0;

    for (const log of pendingPhotos) {
      const mediaUrl = log.raw_payload?.mediaUrl;
      if (!mediaUrl) continue;

      try {
        const imageData = await downloadUazapiMedia(mediaUrl);
        if (!imageData) continue;

        const fileName = `whatsapp_${reportId}_${Date.now()}_${attachedCount}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("service-report-photos")
          .upload(fileName, imageData, { contentType: "image/jpeg" });

        if (!uploadError) {
          const { data: publicUrl } = supabase.storage.from("service-report-photos").getPublicUrl(fileName);
          await supabase.from("report_photos").insert({
            report_id: reportId,
            url: publicUrl.publicUrl,
          });
          attachedCount++;
        }
      } catch (photoErr) {
        console.error("Error attaching pending photo:", photoErr);
      }

      // Update log status regardless
      await supabase
        .from("whatsapp_rdo_logs")
        .update({ status: "photo_attached", report_id: reportId })
        .eq("id", log.id);
    }

    if (attachedCount > 0 && uazapiToken && groupId) {
      const { count: totalPhotos } = await supabase
        .from("report_photos")
        .select("id", { count: "exact", head: true })
        .eq("report_id", reportId);
      const n = totalPhotos ?? attachedCount;
      await sendUazapiText(uazapiToken, groupId,
        `✅ RDO #${rdoCode} registrado com sucesso (${n} foto${n > 1 ? "s" : ""} anexada${n > 1 ? "s" : ""})`);
    }

    console.log(`Attached ${attachedCount} pending photos to RDO #${rdoCode}`);
  } catch (error) {
    console.error("Error in attachPendingPhotos:", error);
  }
}

async function sendUazapiText(token: string, phone: string, message: string) {
  try {
    // Normalize: UAZAPI accepts the JID or bare number. Strip the @suffix when present.
    const number = phone.includes("@") ? phone.split("@")[0] : phone;
    const response = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({ number, text: message }),
    });
    const data = await response.json().catch(() => ({}));
    console.log("UAZAPI send response:", JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("Error sending UAZAPI message:", error);
  }
}

async function downloadUazapiMedia(mediaUrlOrBase64: string, token?: string): Promise<Uint8Array | null> {
  try {
    // Base64 data URL or raw base64
    if (mediaUrlOrBase64.startsWith("data:")) {
      const b64 = mediaUrlOrBase64.split(",")[1] || "";
      return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    }
    if (!/^https?:\/\//i.test(mediaUrlOrBase64) && mediaUrlOrBase64.length > 200) {
      // Looks like raw base64
      try {
        return Uint8Array.from(atob(mediaUrlOrBase64), (c) => c.charCodeAt(0));
      } catch { /* fall through */ }
    }
    const headers: Record<string, string> = {};
    if (token && mediaUrlOrBase64.includes(new URL(UAZAPI_BASE_URL).host)) {
      headers.token = token;
    }
    const response = await fetch(mediaUrlOrBase64, { headers });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    console.error("Error downloading UAZAPI media:", error);
    return null;
  }
}

// Normalize a UAZAPI webhook payload into the shape the RDO pipeline already consumes.
// UAZAPI events come in several shapes depending on server version; we accept all common ones.
function parseUazapiPayload(raw: any): any {
  if (!raw || typeof raw !== "object") return {};

  // Pass-through: payload already in legacy/normalized shape (e.g. from evolution-webhook bridge)
  if (raw.chatId && (typeof raw.text === "object" || raw.body || raw.image || raw.messageId)) {
    return raw;
  }

  // The actual message envelope can be at the root or nested under message/data/messages[0]
  const m = raw.message || raw.data || (Array.isArray(raw.messages) ? raw.messages[0] : null) || raw;

  const chatId: string | undefined =
    m.chatid || m.chatId || m.remoteJid || m.key?.remoteJid || m.from || raw.chatid || raw.chatId;
  const fromMe: boolean = !!(m.fromMe ?? m.fromme ?? m.key?.fromMe);
  const isGroup: boolean = !!(m.isGroup ?? m.isgroup) || (chatId?.includes("@g.us") ?? false);

  const sender: string | undefined =
    m.sender || m.participant || m.author || m.key?.participant || (isGroup ? undefined : chatId);
  const senderPhone = sender ? sender.split("@")[0].replace(/\D/g, "") : undefined;

  const senderName: string =
    m.senderName || m.sendername || m.pushName || m.pushname || m.notifyName || m.participant_name || "";

  // Text resolution across message types
  const text: string =
    m.text ||
    m.content ||
    m.body ||
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    m.message?.videoMessage?.caption ||
    m.conversation ||
    "";

  // Media detection
  const messageType: string = m.messageType || m.messagetype || m.type || "";
  const isImage =
    /image/i.test(messageType) ||
    !!m.image ||
    !!m.message?.imageMessage ||
    !!(m.mediaUrl && /image/i.test(m.mimetype || "")) ||
    (typeof m.mimetype === "string" && m.mimetype.startsWith("image/"));

  const mediaUrl: string | undefined =
    m.mediaUrl ||
    m.mediaurl ||
    m.image?.url ||
    m.image?.imageUrl ||
    m.message?.imageMessage?.url ||
    m.fileUrl ||
    m.url;

  const messageId: string | undefined =
    m.id || m.messageId || m.messageid || m.key?.id;

  // Return an object whose key names match what the existing RDO pipeline reads from `payload`.
  return {
    // Channel routing
    isGroup,
    chatId,
    phone: chatId, // for DM lookups
    participantPhone: senderPhone,
    senderPhone,
    // Identity
    senderName,
    pushName: senderName,
    notifyName: senderName,
    fromMe,
    // Text
    text: { message: text },
    body: text,
    message: text,
    // Media
    isMedia: isImage,
    type: isImage ? "image" : messageType,
    messageType,
    mimetype: m.mimetype,
    image: isImage ? { imageUrl: mediaUrl, url: mediaUrl } : undefined,
    imageMessage: m.message?.imageMessage,
    mediaUrl,
    url: mediaUrl,
    // Ids
    messageId,
    id: { id: messageId },
    // Original for debugging
    _raw: raw,
    _eventType: raw.EventType || raw.event || raw.type,
  };
}

// Deterministic project matching: tries code, contract number, and keywords before calling AI
function matchProjectDeterministic(
  messageText: string,
  projects: Array<{ id: string; name: string; code?: string | null; contract_number?: string | null }>
): string | null {
  if (!messageText || !projects.length) return null;

  const text = messageText.toUpperCase();

  // 1. Match by project code (highest priority)
  for (const p of projects) {
    if (p.code) {
      const codePattern = new RegExp(`\\b${p.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (codePattern.test(text)) {
        console.log(`Deterministic match by code: ${p.code} → ${p.id}`);
        return p.id;
      }
    }
  }

  // 2. Match by contract number
  for (const p of projects) {
    if (p.contract_number) {
      const contractPattern = new RegExp(`\\b${p.contract_number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (contractPattern.test(text)) {
        console.log(`Deterministic match by contract: ${p.contract_number} → ${p.id}`);
        return p.id;
      }
    }
  }

  // 3. Match by strong keywords in project name
  for (const p of projects) {
    const pName = p.name.toUpperCase();
    // Extract 3+ letter keywords from project name
    const keywords = pName.split(/[\s\-_,.\(\)]+/).filter((w) => w.length >= 3);
    for (const kw of keywords) {
      if (kw.length >= 4 && text.includes(kw)) {
        console.log(`Deterministic match by keyword "${kw}": ${p.name} → ${p.id}`);
        return p.id;
      }
    }
  }

  return null;
}

async function identifyProjectWithAI(
  messageText: string,
  projects: Array<{ id: string; name: string; description: string | null; code: string | null; contract_number: string | null; rdo_count?: number; last_rdo_date?: string | null }>
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured, cannot route with AI");
    return null;
  }

  const projectsList = projects.map((p, i) =>
    `${i + 1}. ID: ${p.id} | Nome: ${p.name}${p.code ? ` | Código: ${p.code}` : ""}${p.contract_number ? ` | Contrato: ${p.contract_number}` : ""}${p.description ? ` | Descrição: ${p.description}` : ""}${p.rdo_count ? ` | RDOs registrados: ${p.rdo_count}` : ""}${p.last_rdo_date ? ` | Último RDO: ${p.last_rdo_date}` : ""}`
  ).join("\n");

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um assistente especializado em obras de construção civil e infraestrutura que identifica a qual atividade/projeto pertence um RDO (Relatório Diário de Obra) enviado via WhatsApp.

REGRAS DE IDENTIFICAÇÃO:
1. Compare o texto da mensagem com os NOMES dos projetos/atividades. Procure correspondências de palavras-chave (ex: "duto", "tubulação", "sondagem", "terraplanagem", "elétrica", etc.)
2. Se o texto mencionar um CÓDIGO de projeto (ex: "AT-001", "OBR-123"), use isso como match prioritário
3. Se houver número de contrato mencionado, use como critério forte
4. Projetos com mais RDOs recentes provavelmente são os que estão mais ativos — use como critério de desempate
5. Se o texto não der certeza suficiente para distinguir entre projetos similares, retorne null
6. Analise o TIPO de atividade descrita (ex: "soldagem de duto" → projeto de duto, "lançamento de cabo" → projeto elétrico)`,
          },
          {
            role: "user",
            content: `Atividades/projetos disponíveis nesta unidade:\n${projectsList}\n\nTexto do RDO recebido:\n${messageText}\n\nIdentifique a atividade/projeto correto. Se não tiver certeza, retorne null.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "identify_project",
              description: "Identifica o projeto correto para o RDO baseado no texto da mensagem",
              parameters: {
                type: "object",
                properties: {
                  project_id: { type: "string", description: "O UUID do projeto identificado, ou null se não for possível identificar com confiança" },
                  confidence: { type: "string", enum: ["high", "medium", "low"], description: "Nível de confiança na identificação" },
                  reason: { type: "string", description: "Breve explicação de por que este projeto foi escolhido" },
                },
                required: ["project_id", "confidence", "reason"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "identify_project" } },
      }),
    });

    if (!response.ok) {
      console.error("AI Gateway error:", response.status, await response.text());
      return null;
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;

    const args = JSON.parse(toolCall.function.arguments);
    console.log("AI project identification:", args);

    // Only accept HIGH confidence to ensure accurate routing
    if (args.confidence !== "high" || !args.project_id || args.project_id === "null") {
      console.log(`AI confidence too low or no project: confidence=${args.confidence}, returning null`);
      return null;
    }

    const validIds = projects.map((p) => p.id);
    if (!validIds.includes(args.project_id)) return null;

    return args.project_id;
  } catch (error) {
    console.error("Error calling AI for project identification:", error);
    return null;
  }
}

// Build report data from parsed AI output, mapping all fields correctly
function buildReportData(
  parsedData: any,
  projectId: string,
  createdBy: string | null
): Record<string, any> {
  let reportDate = parsedData.data || new Date().toISOString().split("T")[0];
  // Force current year if parsed year differs (e.g. user typed 2025 but we're in 2026)
  if (parsedData.data) {
    const [year, month, day] = parsedData.data.split("-").map(Number);
    const currentYear = new Date().getFullYear();
    if (year !== currentYear) {
      reportDate = `${currentYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      console.log(`Date corrected from ${parsedData.data} to ${reportDate}`);
    }
  }

  // Map turno to shift enum, with fallback inferred from start time and title keywords
  let shift = "morning";
  if (parsedData.turno === "night") shift = "night";
  else if (parsedData.turno === "afternoon") shift = "afternoon";
  else if (parsedData.turno === "morning") shift = "morning";
  else {
    // Heuristic: detect "noturno" / "diurno" anywhere in title/comments
    const haystack = `${parsedData.tituloOM || ""} ${parsedData.tituloTrabalho || ""} ${parsedData.localAtividade || ""} ${parsedData.comentarios || ""}`.toLowerCase();
    if (/noturn/.test(haystack)) shift = "night";
    else if (/diurn|matutin/.test(haystack)) shift = "morning";
    else if (/vespertin/.test(haystack)) shift = "afternoon";
    else if (parsedData.horaInicio && /^\d{2}:\d{2}/.test(parsedData.horaInicio)) {
      const h = parseInt(parsedData.horaInicio.slice(0, 2), 10);
      if (h >= 18 || h < 6) shift = "night";
      else if (h >= 12) shift = "afternoon";
      else shift = "morning";
    }
  }

  const data: Record<string, any> = {
    project_id: projectId,
    date: reportDate,
    status: "draft",
    shift,
    location: parsedData.localAtividade || "",
    comments: parsedData.comentarios || "",
    weather: "clear",
    created_by: createdBy,
    updated_at: new Date().toISOString(),
    // New fields from AI parsing
    start_time: parsedData.horaInicio || null,
    end_time: parsedData.horaFim || null,
    maintenance_order_number: parsedData.numeroOM || null,
    maintenance_order_title: parsedData.tituloOM || parsedData.tituloTrabalho || null,
    blockage_status: parsedData.bloqueio || null,
    supervisor_name: parsedData.supervisor || null,
    technical_responsible_name: parsedData.responsavelTecnico || null,
    // Safety & documentation fields
    meeting_point: parsedData.pontoEncontro || null,
    ambulance_point: parsedData.pontoAmbulancia || null,
    radio_frequency_wees: parsedData.radioWees || null,
    radio_frequency_operation: parsedData.radioOperacao || null,
    arrival_time_at_liberator: parsedData.horarioChegadaLiberador || null,
    document_release_time: parsedData.horarioLiberacao || null,
    blockage_revalidation_time: parsedData.horarioRevalidacaoBloqueio || null,
  };

  return data;
}

// Insert/update activities from parsed data
async function upsertActivities(supabase: any, reportId: string, parsedData: any, isUpdate: boolean) {
  const activities = parsedData.atividades;
  if (!activities?.length) return;

  if (isUpdate) {
    await supabase.from("report_activities").delete().eq("report_id", reportId);
  }

  const { error } = await supabase.from("report_activities").insert(
    activities.map((a: any) => ({
      report_id: reportId,
      description: typeof a === "string" ? a : a.description || a.descricao || "",
      completed: false,
    }))
  );
  if (error) {
    console.error("Error inserting activities:", error);
  } else {
    console.log(`Inserted ${activities.length} activities`);
  }
}

// Insert/update deviations from parsed data
async function upsertDeviations(supabase: any, reportId: string, parsedData: any, isUpdate: boolean) {
  const deviations = parsedData.desvios;
  if (!deviations?.length) return;

  if (isUpdate) {
    await supabase.from("report_deviations").delete().eq("report_id", reportId);
  }

  const { error } = await supabase.from("report_deviations").insert(
    deviations.map((d: any) => ({
      report_id: reportId,
      description: d.descricao || (typeof d === "string" ? d : d.description || ""),
      type: d.tipo || d.type || "other",
      impact: d.impacto || d.impact || "medium",
      action_taken: d.acaoCorretiva || d.correctiveAction || null,
    }))
  );
  if (error) {
    console.error("Error inserting deviations:", error);
  } else {
    console.log(`Inserted ${deviations.length} deviations`);
  }
}

// Insert/update attendance from parsed efetivo with fuzzy matching
async function upsertAttendance(
  supabase: any,
  reportId: string,
  parsedData: any,
  siteProfiles: Array<{ id: string; name: string | null; job_title: string | null }>,
  isUpdate: boolean,
  preferredIds?: Set<string>
) {
  const efetivo = parsedData.efetivo;
  if (!efetivo?.length) return;

  if (isUpdate) {
    await supabase.from("report_attendance").delete().eq("report_id", reportId);
  }

  const attendanceRows = efetivo.map((item: any) => {
    const nome = typeof item === "string" ? item : item.nome || "";
    const funcao = typeof item === "string" ? null : item.funcao || null;
    const presente = typeof item === "object" && item.presente === false ? false : true;

    const matched = matchCollaborator(nome, siteProfiles, preferredIds);
    if (!matched) {
      console.log(`[NAME_MATCH] unresolved_attendance name="${nome}" funcao="${funcao}" — saving with user_id=NULL`);
    }
    // Prefer the registered profile's job_title when matched (most reliable),
    // then fall back to whatever the AI parsed, then to a generic default.
    const functionRole = matched?.job_title || funcao || "Convencional";

    return {
      report_id: reportId,
      user_id: matched?.id || null,
      user_name: matched?.name || nome,
      function_role: functionRole,
      present: presente,
      arrival_time: parsedData.horaInicio || null,
      departure_time: parsedData.horaFim || null,
    };
  });

  const { error } = await supabase.from("report_attendance").insert(attendanceRows);
  if (error) {
    console.error("Error inserting attendance:", error);
  } else {
    console.log(`Inserted ${attendanceRows.length} attendance records`);
  }

  // Update reports.actual_workforce with count of present workers
  const presentCount = attendanceRows.filter((a: any) => a.present).length;
  const { error: updErr } = await supabase
    .from("reports")
    .update({ actual_workforce: presentCount })
    .eq("id", reportId);
  if (updErr) {
    console.error("Error updating actual_workforce:", updErr);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const rawPayload = await req.json();
    console.log("UAZAPI webhook raw:", JSON.stringify(rawPayload));

    // Ignore non-message events (connection, presence, etc.)
    const eventType = (rawPayload?.EventType || rawPayload?.event || rawPayload?.type || "").toString().toLowerCase();
    if (eventType && !/^messages?(_update)?$/.test(eventType)) {
      return new Response(JSON.stringify({ status: "ignored", reason: `event_${eventType}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = parseUazapiPayload(rawPayload);
    // Ignore messages from self
    if (payload.fromMe) {
      return new Response(JSON.stringify({ status: "ignored", reason: "from_me" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Detect group vs DM
    const isGroup = payload.isGroup || payload.chatId?.includes("@g.us");
    const rawText =
      (typeof payload.text === "string" ? payload.text : payload.text?.message) ||
      (typeof payload.body === "string" ? payload.body : payload.body?.text) ||
      (typeof payload.message === "string" ? payload.message : payload.message?.text) ||
      "";
    const messageText = typeof rawText === "string" ? rawText : "";
    const isImage =
      payload.isMedia ||
      payload.type === "image" ||
      payload.messageType === "image" ||
      !!payload.image ||
      !!payload.imageMessage ||
      !!payload.mediaUrl ||
      (typeof payload.mimetype === "string" && payload.mimetype.startsWith("image/"));

    // Allow DMs only if they look like an RDO or have an image (for photo attachment)
    if (!isGroup && !isRdoMessage(messageText) && !isImage) {
      return new Response(JSON.stringify({ status: "ignored", reason: "not_group_not_rdo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageId = payload.messageId || payload.id?.id;
    const rawGroupId = payload.chatId || payload.from || (isGroup ? payload.phone : null);
    // Canonical group_id: only the numeric JID prefix (no "@g.us", no legacy "-group" suffix).
    // All matches in whatsapp_group_projects and whatsapp_rdo_logs use this canonical form.
    const groupId = rawGroupId
      ? String(rawGroupId).replace(/@g\.us$/i, "").replace(/-group$/i, "")
      : rawGroupId;
    const senderPhone = payload.participantPhone || payload.senderPhone || payload.author?.replace("@c.us", "") || payload.phone;
    const rawSenderName = (payload.senderName || payload.notifyName || payload.pushName || payload.participant?.name || "").trim();
    const isValidSenderName = rawSenderName.length >= 2 && /[a-zA-ZÀ-ú]/.test(rawSenderName);
    let senderName = isValidSenderName ? rawSenderName : "Desconhecido";

    // Pre-resolve the company scope from the group mapping (when in a group)
    // so sender/name lookups can never cross factories/companies.
    let scopeCompanyId: string | null = null;
    let scopeSiteId: string | null = null;
    if (isGroup && groupId) {
      const { data: groupMap } = await supabase
        .from("whatsapp_group_projects")
        .select("site_id, sites:site_id(company_id)")
        .eq("group_id", groupId)
        .eq("is_active", true)
        .maybeSingle();
      if (groupMap?.site_id) {
        scopeSiteId = groupMap.site_id;
        scopeCompanyId = (groupMap as any).sites?.company_id || null;
      }
    }

    // Resolve sender profile EARLY — before logging
    let createdBy: string | null = null;
    if (senderPhone) {
      const cleanPhone = senderPhone.replace(/\D/g, "");
      // Try phone lookup first — scoped to the group's company when known
      let senderQuery = supabase
        .from("profiles")
        .select("id, name, company_id")
        .or(`phone.ilike.%${cleanPhone.slice(-8)}%`);
      if (scopeCompanyId) senderQuery = senderQuery.eq("company_id", scopeCompanyId);
      const { data: senderProfile } = await senderQuery.limit(1).maybeSingle();

      if (senderProfile) {
        createdBy = senderProfile.id;
        if (senderProfile.name && senderProfile.name.trim().length >= 2) {
          senderName = senderProfile.name.trim();
        }
      } else if (scopeCompanyId) {
        // Phone lookup failed within company — try a broader phone match but
        // STILL inside the same company before giving up.
        const { data: broaderProfile } = await supabase
          .from("profiles")
          .select("id, name")
          .eq("company_id", scopeCompanyId)
          .ilike("phone", `%${cleanPhone.slice(-8)}%`)
          .limit(1)
          .maybeSingle();
        if (broaderProfile) {
          createdBy = broaderProfile.id;
          if (broaderProfile.name && broaderProfile.name.trim().length >= 2) {
            senderName = broaderProfile.name.trim();
          }
        }
      }

      // If phone didn't match and we have a valid name from Z-API, try name-based lookup
      // — but ONLY inside the same company to avoid cross-factory confusion.
      if (!createdBy && isValidSenderName && scopeCompanyId) {
        const firstName = rawSenderName.split(" ")[0];
        if (firstName.length >= 3) {
          const { data: nameProfile } = await supabase
            .from("profiles")
            .select("id, name")
            .eq("company_id", scopeCompanyId)
            .ilike("name", `${firstName}%`)
            .limit(5);
          if (nameProfile && nameProfile.length === 1) {
            createdBy = nameProfile[0].id;
            senderName = nameProfile[0].name.trim();
          }
        }
      }
      console.log(`Sender resolution: phone=${cleanPhone}, company=${scopeCompanyId || 'unknown'}, createdBy=${createdBy || 'NOT FOUND'}, final senderName="${senderName}"`);
    }

    // Deduplicate
    if (messageId) {
      const { data: existing } = await supabase
        .from("whatsapp_rdo_logs")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ status: "duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- STANDALONE PHOTO: attach to recent RDO ---
    if (!isRdoMessage(messageText) && isImage) {
      const mediaUrl =
        payload.image?.imageUrl ||
        payload.image?.url ||
        payload.imageMessage?.url ||
        payload.mediaUrl ||
        payload.url;
      if (!mediaUrl) {
        console.warn("Image detected but no mediaUrl found. Payload keys:", Object.keys(payload));
        return new Response(JSON.stringify({ status: "ignored", reason: "image_no_url" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the most recent successful RDO from this group/sender in the last 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const lookupFilter = isGroup && groupId
        ? { column: "group_id", value: groupId }
        : { column: "sender_phone", value: senderPhone };

      const { data: recentRdo } = await supabase
        .from("whatsapp_rdo_logs")
        .select("report_id")
        .eq(lookupFilter.column, lookupFilter.value)
        .eq("status", "success")
        .not("report_id", "is", null)
        .gt("created_at", twoHoursAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!recentRdo?.report_id) {
        // No recent RDO found — save as pending photo for retroactive attachment
        await supabase.from("whatsapp_rdo_logs").insert({
          message_id: messageId,
          group_id: groupId,
          sender_phone: senderPhone,
          sender_name: senderName,
          status: "pending_photo",
          raw_payload: { ...payload, mediaUrl },
        });
        console.log("Photo saved as pending_photo for retroactive attachment");
        return new Response(JSON.stringify({ status: "pending_photo", reason: "saved_for_later_attachment" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const targetReportId = recentRdo.report_id;

      try {
        const imageData = await downloadUazapiMedia(mediaUrl, UAZAPI_TOKEN);
        if (imageData) {
          const fileName = `whatsapp_${targetReportId}_${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("service-report-photos")
            .upload(fileName, imageData, { contentType: "image/jpeg" });

          if (!uploadError) {
            const { data: publicUrl } = supabase.storage.from("service-report-photos").getPublicUrl(fileName);
            await supabase.from("report_photos").insert({
              report_id: targetReportId,
              url: publicUrl.publicUrl,
            });

            // Count photos to show in confirmation
            const { count } = await supabase
              .from("report_photos")
              .select("id", { count: "exact", head: true })
              .eq("report_id", targetReportId);

            // Get RDO number for confirmation
            const { data: rInfo } = await supabase
              .from("reports")
              .select("rdo_number")
              .eq("id", targetReportId)
              .single();

            const rdoNum = rInfo?.rdo_number || "?";
            if (UAZAPI_TOKEN && groupId) {
              const n = count || 1;
              await sendUazapiText(UAZAPI_TOKEN, groupId,
                `✅ RDO #${rdoNum} registrado com sucesso (${n} foto${n > 1 ? "s" : ""} anexada${n > 1 ? "s" : ""})`);
            }
          }
        }
      } catch (photoError) {
        console.error("Error attaching standalone photo:", photoError);
      }

      return new Response(JSON.stringify({ status: "photo_attached", reportId: targetReportId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter non-RDO messages (text without RDO indicators and no image)
    if (!isRdoMessage(messageText)) {
      // Log ignored messages from mapped groups for visibility
      if (isGroup && groupId) {
        const { data: mapping } = await supabase
          .from("whatsapp_group_projects")
          .select("site_id")
          .eq("group_id", groupId)
          .eq("is_active", true)
          .maybeSingle();
        if (mapping) {
          await supabase.from("whatsapp_rdo_logs").insert({
            message_id: messageId,
            group_id: groupId,
            sender_phone: senderPhone,
            sender_name: senderName,
            status: "ignored",
            error_message: "Mensagem não contém indicadores de RDO",
            raw_payload: payload,
          });
        }
      }
      return new Response(JSON.stringify({ status: "ignored", reason: "not_rdo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up site mapping
    let siteId: string | null = null;

    if (isGroup && groupId) {
      const { data: mapping } = await supabase
        .from("whatsapp_group_projects")
        .select("site_id, group_name")
        .eq("group_id", groupId)
        .eq("is_active", true)
        .maybeSingle();
      siteId = mapping?.site_id || null;
    }

    if (!siteId && senderPhone) {
      const cleanPhone = senderPhone.replace(/\D/g, "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .or(`phone.ilike.%${cleanPhone.slice(-8)}%`)
        .limit(1)
        .maybeSingle();
      if (profile) {
        const { data: siteResp } = await supabase
          .from("site_responsibles")
          .select("site_id")
          .eq("user_id", profile.id)
          .limit(1)
          .maybeSingle();
        siteId = siteResp?.site_id || null;
      }
    }

    if (!siteId) {
      await supabase.from("whatsapp_rdo_logs").insert({
        message_id: messageId,
        group_id: groupId,
        sender_phone: senderPhone,
        sender_name: senderName,
        status: "error",
        error_message: isGroup ? "Grupo não mapeado a nenhuma unidade" : "Remetente não vinculado a nenhuma unidade",
        raw_payload: payload,
      });
      return new Response(JSON.stringify({ status: "error", reason: "no_mapping" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve active projects from site
    let { data: activeProjects } = await supabase
      .from("projects")
      .select("id, name, description, code, contract_number")
      .eq("site_id", siteId)
      .not("status", "in", '("completed","suspended")')
      .order("created_at", { ascending: false });

    let autoCreatedProject = false;
    if (!activeProjects || activeProjects.length === 0) {
      // Auto-create project for this site
      console.log("No active projects found, auto-creating project...");

      // Get company_id from site
      const { data: siteData } = await supabase
        .from("sites")
        .select("company_id, name")
        .eq("id", siteId)
        .single();

      if (!siteData?.company_id) {
        await supabase.from("whatsapp_rdo_logs").insert({
          message_id: messageId, group_id: groupId, sender_phone: senderPhone, sender_name: senderName,
          status: "error", error_message: "Unidade sem empresa vinculada", raw_payload: payload,
        });
        return new Response(JSON.stringify({ status: "error", reason: "no_company" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to extract project name from message text (supports multiline WhatsApp format)
      let projectName = "Atividade criada via WhatsApp";
      // Priority 1: "Local da Atividade:" or "Local:" (same line or next line)
      const localMatch = messageText.match(/(?:Local\s*(?:da\s*(?:atividade|obra|trabalho))?|[Áá]rea|Sub[áa]rea|Setor|Regi[ãa]o|Unidade)[:\s]*\n?\s*(.+)/i);
      // Priority 2: "Título da OM:" followed by content on next line
      const tituloOmMatch = messageText.match(/T[íi]tulo\s*(?:da\s*)?OM[:\s]*\n\s*(.+)/i);
      // Priority 3: "OM:" or "Ordem de Manutenção:" (same line or next line)
      const omMatch = messageText.match(/(?:OM|O\.M\.|Ordem de Manuten[çc][ãa]o)[:\s]*\n?\s*(.+)/i);
      // Priority 4: "Título:" or "Serviço:" (same line or next line)
      const tituloMatch = messageText.match(/(?:T[íi]tulo|Atividade Principal|Servi[çc]o)[:\s]*\n?\s*(.+)/i);
      if (localMatch?.[1]?.trim()) {
        projectName = localMatch[1].trim().substring(0, 100);
      } else if (tituloOmMatch?.[1]?.trim()) {
        projectName = tituloOmMatch[1].trim().substring(0, 100);
      } else if (omMatch?.[1]?.trim()) {
        projectName = omMatch[1].trim().substring(0, 100);
      } else if (tituloMatch?.[1]?.trim()) {
        projectName = tituloMatch[1].trim().substring(0, 100);
      } else if (chatName) {
        projectName = chatName.replace(/^RDO[\s-]*/i, "").trim() || projectName;
      }

      const today = new Date().toISOString().split("T")[0];
      const { data: newProject, error: projErr } = await supabase
        .from("projects")
        .insert({
          site_id: siteId,
          company_id: siteData.company_id,
          name: projectName,
          status: "in_progress",
          start_date: today,
        })
        .select("id, name")
        .single();

      if (projErr || !newProject) {
        console.error("Failed to auto-create project:", projErr);
        await supabase.from("whatsapp_rdo_logs").insert({
          message_id: messageId, group_id: groupId, sender_phone: senderPhone, sender_name: senderName,
          status: "error", error_message: `Erro ao criar atividade automaticamente: ${projErr?.message}`, raw_payload: payload,
        });
        return new Response(JSON.stringify({ status: "error", reason: "auto_create_failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Push to activeProjects so rest of flow works
      activeProjects = [{ id: newProject.id, name: newProject.name, description: null, code: null, contract_number: null }];
      autoCreatedProject = true;
      console.log(`Auto-created project "${newProject.name}" (${newProject.id})`);
    }

    // Determine project ID
    let projectId: string;
    if (activeProjects.length === 1) {
      projectId = activeProjects[0].id;
    } else {
      // Try deterministic matching first (by code, contract, keywords)
      const deterministicId = matchProjectDeterministic(messageText, activeProjects);
      if (deterministicId) {
        projectId = deterministicId;
      } else {
        // Enrich projects with RDO stats for better AI routing
        const enrichedProjects = await Promise.all(activeProjects.map(async (p) => {
          const { count } = await supabase
            .from("reports")
            .select("*", { count: "exact", head: true })
            .eq("project_id", p.id);
          const { data: lastReport } = await supabase
            .from("reports")
            .select("date")
            .eq("project_id", p.id)
            .order("date", { ascending: false })
            .limit(1)
            .single();
          return {
            ...p,
            rdo_count: count || 0,
            last_rdo_date: lastReport?.date || null,
          };
        }));

        console.log(`Found ${activeProjects.length} active projects for site, calling AI to route...`);
        const aiResult = await identifyProjectWithAI(messageText, enrichedProjects);
        if (aiResult) {
          projectId = aiResult;
        } else {
          await supabase.from("whatsapp_rdo_logs").insert({
            message_id: messageId, group_id: groupId, sender_phone: senderPhone, sender_name: senderName,
            status: "error", error_message: "IA não conseguiu identificar a atividade (múltiplas ativas)", raw_payload: payload,
          });
          if (UAZAPI_TOKEN) {
            const projectList = activeProjects.map((p, i) => {
              const emoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"][i] || `${i + 1}.`;
              return `${emoji} ${p.name}${p.code ? ` (${p.code})` : ""}`;
            }).join("\n");
            await sendUazapiText(UAZAPI_TOKEN, groupId,
              `🤔 Esta unidade tem ${activeProjects.length} atividades ativas e não consegui identificar a qual atividade este RDO pertence.\n\nAtividades ativas:\n${projectList}\n\nPor favor, inclua o nome ou código da atividade na mensagem e envie novamente.`);
          }
          return new Response(JSON.stringify({ status: "error", reason: "multiple_projects_unresolved" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Log the incoming message
    const { data: logEntry } = await supabase
      .from("whatsapp_rdo_logs")
      .insert({
        message_id: messageId, group_id: groupId, sender_phone: senderPhone, sender_name: senderName,
        status: "processing", raw_payload: payload,
      })
      .select()
      .single();

    // Fetch site profiles for fuzzy matching attendance
    const { data: siteProfiles } = await supabase
      .from("profiles")
      .select("id, name, job_title")
      .in("id", (
        await supabase.from("site_responsibles").select("user_id").eq("site_id", siteId)
      ).data?.map((r: any) => r.user_id) || []);

    // Also fetch team members for this project
    const { data: teamMemberIds } = await supabase
      .from("team_members")
      .select("user_id, teams!inner(project_id)")
      .eq("teams.project_id", projectId);

    let allProfileIds = new Set<string>();
    (siteProfiles || []).forEach((p: any) => allProfileIds.add(p.id));
    (teamMemberIds || []).forEach((tm: any) => allProfileIds.add(tm.user_id));

    // If we have extra team member IDs not in siteProfiles, fetch them
    const extraIds = [...allProfileIds].filter((id) => !(siteProfiles || []).find((p: any) => p.id === id));
    let allProfiles = [...(siteProfiles || [])];
    if (extraIds.length > 0) {
      const { data: extraProfiles } = await supabase
        .from("profiles")
        .select("id, name, job_title")
        .in("id", extraIds);
      if (extraProfiles) allProfiles = [...allProfiles, ...extraProfiles];
    }

    // Track preferred IDs (responsibles of THIS site + team members of this project)
    const preferredIds = new Set<string>(allProfiles.map((p: any) => p.id));

    // Fallback: fetch ALL profiles linked (via site_responsibles) to THIS site.
    // REMOVIDO: busca em outras unidades da mesma empresa (causava match indevido de nomes similares em sites distantes).
    const { data: siteData } = await supabase
      .from("sites")
      .select("company_id")
      .eq("id", siteId)
      .single();

    // Fallback adicional: colaboradores internos importados em massa (e-mail @internal.local)
    // RESTRITO: incluímos apenas os que estão em site_responsibles DESTA unidade ou que já tiveram
    // registros de presença neste site anteriormente (cache de histórico operacional).
    try {
      // Já buscamos site_responsibles acima (siteProfiles). 
      // Agora buscamos quem já teve presença nesta unidade (siteId) nos últimos 90 dias.
      const { data: historicUserIds } = await supabase
        .from("report_attendance")
        .select("user_id, reports!inner(project_id, projects!inner(site_id))")
        .eq("reports.projects.site_id", siteId)
        .not("user_id", "is", null)
        .limit(200);

      const combinedIds = new Set([
        ...allProfiles.map(p => p.id),
        ...(historicUserIds || []).map((r: any) => r.user_id)
      ]);

      const missingIds = [...combinedIds].filter(id => !allProfiles.find(p => p.id === id));
      
      if (missingIds.length > 0) {
        const { data: extraProfiles } = await supabase
          .from("profiles")
          .select("id, name, job_title")
          .in("id", missingIds);
        if (extraProfiles) {
          for (const ep of extraProfiles) {
            if (!allProfiles.find(p => p.id === ep.id)) {
              allProfiles.push(ep);
            }
          }
        }
      }
    } catch (e) {
      console.error("Error fetching historical profiles fallback:", e);
    }

    // Fallback adicional 2: admins e super_admins da empresa do site.
    // Garante que gestores que não estão em site_responsibles também sejam reconhecidos
    // (ex.: Administrador da empresa que assina o WhatsApp mas não foi adicionado como responsável de uma unidade específica).
    try {
      if (siteData?.company_id) {
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "super_admin"]);

        const adminIds = [...new Set((adminRoles || []).map((r: any) => r.user_id))];
        if (adminIds.length > 0) {
          const existing = new Set(allProfiles.map((p: any) => p.id));
          const missingIds = adminIds.filter((id) => !existing.has(id));
          if (missingIds.length > 0) {
            const { data: adminProfiles } = await supabase
              .from("profiles")
              .select("id, name, job_title, company_id")
              .in("id", missingIds);

            let added = 0;
            for (const ap of adminProfiles || []) {
              // Inclui admin se: pertence à mesma empresa do site OU é super_admin (sem company_id especificado)
              const isSuper = !ap.company_id;
              if (isSuper || ap.company_id === siteData.company_id) {
                allProfiles.push({ id: ap.id, name: ap.name, job_title: ap.job_title });
                added++;
              }
            }
            if (added > 0) console.log(`Added ${added} admin/super_admin profiles to matching pool`);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching admin profiles fallback:", e);
    }

    if (allProfiles.length === 0) {
      console.log("No profiles available for fuzzy matching — keeping raw parsed names");
    }

    console.log(`Loaded ${allProfiles.length} profiles for fuzzy matching`);

    const registeredNames = allProfiles.filter((p: any) => p.name).map((p: any) => p.name);

    // Parse report text via AI — now sending registeredNames
    let parsedData: any = {};
    try {
      const parseResponse = await fetch(`${SUPABASE_URL}/functions/v1/parse-report-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ text: messageText, projectId, registeredNames }),
      });
      if (parseResponse.ok) {
        const parseResult = await parseResponse.json();
        parsedData = parseResult.data || parseResult;
      } else {
        console.error("Parse failed:", await parseResponse.text());
      }
    } catch (parseError) {
      console.error("Error calling parse-report-text:", parseError);
    }

    // Deterministic date extraction from raw message — overrides AI to avoid hallucinations
    // Supports: DD/MM/YYYY, DD/MM/YY, DD.MM.YYYY, DD.MM.YY, DD-MM-YY, DD-MM-YYYY
    const dateRegex = /(?:data|dia)\s*[:：]?\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/i;
    const dateMatch = messageText.match(dateRegex);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      let year = parseInt(dateMatch[3], 10);
      if (year < 100) year += 2000;
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        const extracted = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (parsedData.data !== extracted) {
          console.log(`Date overridden by regex: AI returned "${parsedData.data}", text says "${extracted}"`);
        }
        parsedData.data = extracted;
      }
    }

    const reportDate = parsedData.data || new Date().toISOString().split("T")[0];
    const isCorrection = isCorrectionMessage(messageText);

    // Build report data using correct field mapping (needed early to know resolved shift)
    const reportData = buildReportData(parsedData, projectId, createdBy);
    const resolvedShift = reportData.shift;

    // Check for existing report (same sender + date + group + SHIFT)
    // Shift is part of the dedup key so diurno/noturno on the same date don't overwrite each other.
    let existingReportId: string | null = null;
    const { data: existingLogs } = await supabase
      .from("whatsapp_rdo_logs")
      .select("report_id, report_date")
      .eq("group_id", groupId)
      .eq("sender_phone", senderPhone)
      .eq("report_date", reportDate)
      .eq("status", "success")
      .not("report_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (existingLogs && existingLogs.length > 0) {
      const candidateIds = existingLogs.map((l: any) => l.report_id).filter(Boolean);
      if (candidateIds.length > 0) {
        const { data: candidateReports } = await supabase
          .from("reports")
          .select("id, shift")
          .in("id", candidateIds)
          .eq("shift", resolvedShift);
        if (candidateReports && candidateReports.length > 0) {
          // Preserve order from the logs query (most recent first)
          const matchSet = new Set(candidateReports.map((r: any) => r.id));
          const ordered = candidateIds.find((id: string) => matchSet.has(id));
          if (ordered && (isCorrection || true)) {
            existingReportId = ordered;
          }
        }
      }
    }


    let reportId: string;
    let actionType: "created" | "updated";

    if (existingReportId) {
      const { error: updateError } = await supabase
        .from("reports")
        .update(reportData)
        .eq("id", existingReportId);
      if (updateError) throw new Error(`Erro ao atualizar RDO: ${updateError.message}`);
      reportId = existingReportId;
      actionType = "updated";

      await upsertActivities(supabase, reportId, parsedData, true);
      await upsertDeviations(supabase, reportId, parsedData, true);
      await upsertAttendance(supabase, reportId, parsedData, allProfiles, true, preferredIds);
    } else {
      const { data: newReport, error: insertError } = await supabase
        .from("reports")
        .insert(reportData)
        .select("id, rdo_number")
        .single();
      if (insertError) throw new Error(`Erro ao criar RDO: ${insertError.message}`);
      reportId = newReport.id;
      actionType = "created";

      await upsertActivities(supabase, reportId, parsedData, false);
      await upsertDeviations(supabase, reportId, parsedData, false);
      await upsertAttendance(supabase, reportId, parsedData, allProfiles, false, preferredIds);
    }

    // Update project name with AI-extracted title - prioritize Local da Atividade
    if (parsedData.localAtividade || parsedData.tituloOM || parsedData.tituloTrabalho) {
      const omTitle = (parsedData.localAtividade || parsedData.tituloOM || parsedData.tituloTrabalho).trim().substring(0, 100);
      if (omTitle && autoCreatedProject) {
        const { error: nameErr } = await supabase
          .from("projects")
          .update({ name: omTitle })
          .eq("id", projectId);
        if (!nameErr) {
          console.log(`Project name updated to: "${omTitle}"`);
        }
      }
    }

    // Handle photos
    if (payload.image?.imageUrl || payload.mediaUrl) {
      const mediaUrl = payload.image?.imageUrl || payload.mediaUrl;
      try {
        const imageData = await downloadUazapiMedia(mediaUrl, UAZAPI_TOKEN);
        if (imageData) {
          const fileName = `whatsapp_${reportId}_${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("service-report-photos")
            .upload(fileName, imageData, { contentType: "image/jpeg" });
          if (!uploadError) {
            const { data: publicUrl } = supabase.storage.from("service-report-photos").getPublicUrl(fileName);
            await supabase.from("report_photos").insert({
              report_id: reportId,
              url: publicUrl.publicUrl,
            });
          }
        }
      } catch (photoError) {
        console.error("Error handling photo:", photoError);
      }
    }

    // Get RDO number and project name for confirmation
    const { data: reportInfo } = await supabase
      .from("reports")
      .select("rdo_number, projects(name)")
      .eq("id", reportId)
      .single();

    const rdoCode = reportInfo?.rdo_number || "?";
    const projectName = (reportInfo as any)?.projects?.name || "";

    // Enrich report_history entry created by trigger — mark as WhatsApp automation
    const whatsappAction = actionType === "created" ? "whatsapp_created" : "whatsapp_updated";
    const whatsappDetails = {
      method: "whatsapp_uazapi",
      sender_name: senderName || "Desconhecido",
      sender_phone: senderPhone || "",
      group_id: groupId || "",
      automated: true,
    };

    // Find the most recent history entry for this report and update it
    const triggerAction = actionType === "created" ? "created" : "status_changed";
    const { data: historyEntry } = await supabase
      .from("report_history")
      .select("id")
      .eq("report_id", reportId)
      .eq("action", triggerAction)
      .order("action_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (historyEntry) {
      await supabase
        .from("report_history")
        .update({ action: whatsappAction, details: whatsappDetails })
        .eq("id", historyEntry.id);
    } else {
      // Fallback: insert a new history entry if trigger entry not found
      await supabase.from("report_history").insert({
        report_id: reportId,
        action: whatsappAction,
        action_by: createdBy,
        details: whatsappDetails,
      });
    }

    // Update log
    await supabase
      .from("whatsapp_rdo_logs")
      .update({ status: "success", report_id: reportId, report_date: reportDate })
      .eq("id", logEntry.id);

    // Attach any pending photos that arrived before the RDO was processed
    const rdoCodeForPhotos = reportInfo?.rdo_number || rdoCode || "?";
    await attachPendingPhotos(supabase, groupId, senderPhone, reportId, rdoCodeForPhotos, UAZAPI_TOKEN || null);

    // Generate AI summary automatically
    let aiSummaryText = "";
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const summaryActivities = (parsedData.atividades || []).map((a: any) => ({
          description: typeof a === "string" ? a : a.description || a.descricao || "",
          completed: false,
        }));
        const summaryDeviations = (parsedData.desvios || []).map((d: any) => ({
          description: d.descricao || (typeof d === "string" ? d : d.description || ""),
        }));
        const summaryAttendance = (parsedData.efetivo || []).map((e: any) => ({
          present: typeof e === "object" && e.presente === false ? false : true,
        }));

        const summaryResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-report-summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            activities: summaryActivities,
            deviations: summaryDeviations,
            attendance: summaryAttendance,
            date: parsedData.data || reportDate,
            shift: parsedData.turno || "morning",
            projectName: projectName || "",
          }),
        });

        if (summaryResponse.ok) {
          const summaryResult = await summaryResponse.json();
          if (summaryResult?.summary) {
            aiSummaryText = summaryResult.summary;
            const { data: updated, error: updErr } = await supabase
              .from("reports")
              .update({ ai_summary: aiSummaryText })
              .eq("id", reportId)
              .select("id");

            if (updErr || !updated?.length) {
              console.error("Failed to persist ai_summary", {
                reportId,
                rdoCode,
                error: updErr,
                rows: updated?.length ?? 0,
                textLength: aiSummaryText.length,
              });
            } else {
              console.log(`AI technical summary persisted for RDO #${rdoCode} (${aiSummaryText.length} chars)`);
            }
          } else {
            console.warn("AI summary response had no 'summary' field", { rdoCode, summaryResult });
          }
        } else {
          console.warn("AI summary generation failed:", summaryResponse.status);
        }
      }
    } catch (aiError) {
      console.error("Error generating AI summary (non-blocking):", aiError);
    }

    // Send confirmation
    if (UAZAPI_TOKEN) {
      let confirmMsg = `📝 RDO #${rdoCode} recebido. Envie as fotos agora — confirmarei o registro assim que forem anexadas.`;

      if (autoCreatedProject && projectName) {
        confirmMsg += `\n📁 Nova atividade criada: ${projectName}`;
      } else if (activeProjects.length > 1 && projectName) {
        confirmMsg += `\n📁 Atividade: ${projectName}`;
      }

      await sendUazapiText(UAZAPI_TOKEN, groupId, confirmMsg);
    }

    return new Response(
      JSON.stringify({ status: "success", action: actionType, reportId, rdoNumber: rdoCode }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ status: "error", error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
