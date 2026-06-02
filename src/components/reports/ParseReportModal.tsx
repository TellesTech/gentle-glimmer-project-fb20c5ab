import { useState } from 'react';
import { Sparkles, ClipboardPaste, Loader2, X, CheckCircle2, AlertTriangle, ChevronDown, Lightbulb, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { ReportFormData } from '@/pages/ReportForm';
import type { Activity, Attendance, Deviation, DeviationType, ImpactLevel } from '@/types';

interface ProfileBasic {
  id: string;
  name: string | null;
  jobTitle?: string;
}

interface ParseReportModalProps {
  onDataParsed: (data: Partial<ReportFormData>) => void;
  teamMembers?: { id: string; name: string }[];
  allProfiles?: ProfileBasic[];
}

interface EfetivoItem {
  nome: string;
  funcao?: string | null;
  presente?: boolean;
}

interface ParsedReportData {
  data: string | null;
  turno: 'morning' | 'afternoon' | 'night' | null;
  localAtividade: string | null;
  horaInicio: string | null;
  horaFim: string | null;
  radioWees: string | null;
  radioOperacao: string | null;
  numeroOM: string | null;
  tituloOM: string | null;
  tituloTrabalho: string | null;
  horarioChegadaLiberador: string | null;
  horarioLiberacao: string | null;
  bloqueio: string | null;
  horarioRevalidacaoBloqueio: string | null;
  atividades: string[] | null;
  efetivo: (EfetivoItem | string)[] | null;
  pontoAmbulancia: string | null;
  pontoEncontro: string | null;
  desvios: Array<{
    descricao: string;
    tipo: string;
    impacto: string;
    acaoCorretiva: string;
  }> | null;
  supervisor: string | null;
  responsavelTecnico: string | null;
  comentarios: string | null;
}

interface ParseResult {
  formData: Partial<ReportFormData>;
  filledFields: string[];
  missingFields: string[];
  matchedCollaborators: string[];
  unmatchedCollaborators: string[];
}

// Pre-process text before sending to AI
function preprocessText(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')           // 3+ consecutive line breaks → 2
    .replace(/  +/g, ' ')                  // multiple spaces → single
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // remove zero-width chars
    .replace(/\t/g, ' ')                   // tabs → spaces
    .trim();
}

// Stop-words de cargos/níveis para isolar apenas o nome próprio
const FUNCTION_STOPWORDS = new Set<string>([
  'soldador','soldadora','sold',
  'pintor','pintora',
  'mecanico','mecanica','mec',
  'caldeireiro','cald',
  'ajudante','auxiliar','aux',
  'supervisor','supervisora','sup',
  'oficial','meio',
  'encarregado','encarregada',
  'lider','liderado',
  'tecnico','tecnica',
  'eletricista',
  'serralheiro','serralheira',
  'montador','montadora',
  'escalador','escaladora','alpinista',
  'inspetor','inspetora',
  'almoxarife',
  'operador','operadora',
  'motorista',
  'convencional',
  'junior','jr','senior','sr',
  'n1','n2','n3','i','ii','iii',
  'obra','seguranca','soldagem','pintura',
  'de','do','da','dos','das',
]);

function stripAccents(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeName(s: string): string {
  return stripAccents((s || '').toLowerCase())
    .replace(/^\s*\d+[\.\)\-:]\s*/, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFunctionTokens(normalized: string): string {
  return normalized
    .split(' ')
    .filter((t) => t.length > 0 && !FUNCTION_STOPWORDS.has(t))
    .join(' ')
    .trim();
}

// Damerau-Levenshtein (cobre transposições como "mardem"/"marden")
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

// Match um nome contra perfis cadastrados.
// Estratégia espelha o webhook: prioriza confiança e devolve null em caso de ambiguidade real.
const matchCollaborator = (parsedName: string, profiles: ProfileBasic[]): ProfileBasic | null => {
  if (!parsedName || typeof parsedName !== 'string') return null;

  const rawNormalized = normalizeName(parsedName);
  const normalized = stripFunctionTokens(rawNormalized) || rawNormalized;
  if (!normalized) return null;

  const parts = normalized.split(' ').filter(Boolean);
  const firstName = parts[0];
  const secondName = parts[1];

  const norm = (p: ProfileBasic) => stripFunctionTokens(normalizeName(p.name || ''));

  // 1. Match exato pelo nome completo
  const exactMatches = profiles.filter((p) => p.name && norm(p) === normalized);
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) return null;

  // 2. Primeiro + segundo nome (cobre "Antonio Mardem" -> "Antonio Marden da Silva")
  if (secondName) {
    const twoMatches = profiles.filter((p) => {
      if (!p.name) return false;
      const np = norm(p).split(' ');
      if (np.length < 2) return false;
      // primeiro nome igual; sobrenome com tolerância de 2 (cobre Mardem/Marden)
      if (np[0] !== firstName) return false;
      return np.slice(1).some((tok) => damerauLevenshtein(secondName, tok) <= 2);
    });
    if (twoMatches.length === 1) return twoMatches[0];
    if (twoMatches.length > 1) return null;
  }

  // 3. Fuzzy do primeiro nome (cobre Bernado/Bernardo, Wilian/Willian)
  const maxDist = Math.max(1, Math.floor(firstName.length * 0.25));
  let bestDist = Number.POSITIVE_INFINITY;
  let candidates: ProfileBasic[] = [];
  for (const p of profiles) {
    if (!p.name) continue;
    const pFull = norm(p);
    const pFirst = pFull.split(' ')[0];
    if (!pFirst) continue;

    const dist = damerauLevenshtein(firstName, pFirst);
    if (dist > maxDist) continue;

    // Bloqueia gênero (Paulo/Paula, Emanuel/Emanuela)
    const l1 = firstName.length;
    const l2 = pFirst.length;
    const isVowelSuffix = (c: string) => ['a', 'o', 'e'].includes(c);
    if (Math.abs(l1 - l2) === 1 && dist === 1) {
      const shorter = l1 < l2 ? firstName : pFirst;
      const longer = l1 < l2 ? pFirst : firstName;
      if (longer.startsWith(shorter) && isVowelSuffix(longer[longer.length - 1])) continue;
    } else if (l1 === l2 && dist === 1) {
      if (
        firstName.slice(0, -1) === pFirst.slice(0, -1)
        && isVowelSuffix(firstName[l1 - 1])
        && isVowelSuffix(pFirst[l2 - 1])
      ) continue;
    }

    if (dist < bestDist) { bestDist = dist; candidates = [p]; }
    else if (dist === bestDist) candidates.push(p);
  }

  // Fallback: token contido em qualquer posição do nome do perfil
  // Útil para "Erivan" -> "Francisco Erivan Alves Barros Filho"
  // ou "Maranhão" como apelido de uma pessoa cadastrada.
  const tokenFallback = (): ProfileBasic | null => {
    const tokenMatches = profiles.filter((p) => {
      if (!p.name) return false;
      const tokens = norm(p).split(' ');
      return tokens.some((tok) => tok.length >= 3 && damerauLevenshtein(firstName, tok) <= 1);
    });
    if (tokenMatches.length === 1) return tokenMatches[0];
    return null;
  };

  if (candidates.length === 0) {
    return tokenFallback();
  }

  // Se o input tinha sobrenome, exige sobrenome compatível
  if (secondName) {
    const validated = candidates.filter((p) => {
      const np = norm(p).split(' ');
      if (np.length < 2) return false;
      return np.slice(1).some((tok) => damerauLevenshtein(secondName, tok) <= 2);
    });
    if (validated.length === 0) return tokenFallback();
    candidates = validated;
  }

  if (candidates.length === 1) return candidates[0];

  // Última tentativa: token em qualquer posição
  if (parts.length === 1) {
    const fb = tokenFallback();
    if (fb) return fb;
  }

  return null;
};

const FIELD_LABELS: Record<string, string> = {
  date: 'Data',
  shift: 'Turno',
  activityLocation: 'Local da atividade',
  startTime: 'Horário de início',
  endTime: 'Horário de fim',
  radioFrequencyWees: 'Rádio Wees',
  radioFrequencyOperation: 'Rádio Operação',
  maintenanceOrderNumber: 'Nº OM',
  maintenanceOrderTitle: 'Título OM/Trabalho',
  arrivalTimeAtLiberator: 'Chegada liberador',
  documentReleaseTime: 'Horário liberação',
  blockageStatus: 'Bloqueio',
  activities: 'Atividades',
  attendance: 'Efetivo',
  ambulancePoint: 'Ponto ambulância',
  meetingPoint: 'Ponto de encontro',
  blockRevalidationTime: 'Revalidação bloqueio',
  deviations: 'Desvios',
  comments: 'Comentários',
  supervisorName: 'Supervisor',
  technicalResponsibleName: 'Responsável técnico',
};

const ALL_TRACKABLE_FIELDS = Object.keys(FIELD_LABELS);

export function ParseReportModal({ onDataParsed, teamMembers = [], allProfiles = [] }: ParseReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const { toast } = useToast();

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setText(clipboardText);
      toast({
        title: 'Texto colado',
        description: 'O texto foi colado da área de transferência.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao colar',
        description: 'Não foi possível acessar a área de transferência. Cole manualmente.',
        variant: 'destructive',
      });
    }
  };

  const handleApply = () => {
    if (!parseResult) return;
    onDataParsed(parseResult.formData);
    
    const attendanceInfo = parseResult.matchedCollaborators.length > 0 || parseResult.unmatchedCollaborators.length > 0
      ? ` ${parseResult.matchedCollaborators.length}/${parseResult.matchedCollaborators.length + parseResult.unmatchedCollaborators.length} colaboradores identificados.`
      : '';
    
    toast({
      title: 'Relatório aplicado!',
      description: `${parseResult.filledFields.length}/${ALL_TRACKABLE_FIELDS.length} campos preenchidos.${attendanceInfo} Revise os dados.`,
    });

    setIsOpen(false);
    setText('');
    setParseResult(null);
  };

  const handleRetry = () => {
    setParseResult(null);
  };

  const handleParse = async () => {
    if (!text.trim()) {
      toast({
        title: 'Texto vazio',
        description: 'Cole o relatório do WhatsApp no campo acima.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setParseResult(null);

    try {
      const processedText = preprocessText(text);

      // Send registered profile names to help AI correct spellings
      const registeredNames = allProfiles
        .filter(p => p.name)
        .map(p => p.name as string);

      const { data, error } = await supabase.functions.invoke('parse-report-text', {
        body: { text: processedText, registeredNames },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao processar relatório');
      }

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Não foi possível interpretar o relatório');
      }

      const parsed: ParsedReportData = data.data;
      const formData: Partial<ReportFormData> = {};
      const filledFields: string[] = [];
      const missingFields: string[] = [];
      const matchedCollaborators: string[] = [];
      const unmatchedCollaborators: string[] = [];

      // Date
      if (parsed.data) {
        const [year, month, day] = parsed.data.split('-').map(Number);
        formData.date = new Date(year, month - 1, day);
        filledFields.push('date');
      } else { missingFields.push('date'); }

      // Shift
      if (parsed.turno) { formData.shift = parsed.turno; filledFields.push('shift'); }
      else { missingFields.push('shift'); }

      // Location
      if (parsed.localAtividade) { formData.activityLocation = parsed.localAtividade; filledFields.push('activityLocation'); }
      else { missingFields.push('activityLocation'); }

      // Times
      if (parsed.horaInicio) { formData.startTime = parsed.horaInicio; filledFields.push('startTime'); }
      else { missingFields.push('startTime'); }
      if (parsed.horaFim) { formData.endTime = parsed.horaFim; filledFields.push('endTime'); }
      else { missingFields.push('endTime'); }

      // Radio
      if (parsed.radioWees) { formData.radioFrequencyWees = parsed.radioWees; filledFields.push('radioFrequencyWees'); }
      else { missingFields.push('radioFrequencyWees'); }
      if (parsed.radioOperacao) { formData.radioFrequencyOperation = parsed.radioOperacao; filledFields.push('radioFrequencyOperation'); }
      else { missingFields.push('radioFrequencyOperation'); }

      // OM
      if (parsed.numeroOM) { formData.maintenanceOrderNumber = parsed.numeroOM; filledFields.push('maintenanceOrderNumber'); }
      else { missingFields.push('maintenanceOrderNumber'); }

      if (parsed.tituloOM || parsed.tituloTrabalho) { formData.maintenanceOrderTitle = parsed.tituloOM || parsed.tituloTrabalho; filledFields.push('maintenanceOrderTitle'); }
      else { missingFields.push('maintenanceOrderTitle'); }

      // Liberator
      if (parsed.horarioChegadaLiberador) { formData.arrivalTimeAtLiberator = parsed.horarioChegadaLiberador; filledFields.push('arrivalTimeAtLiberator'); }
      else { missingFields.push('arrivalTimeAtLiberator'); }
      if (parsed.horarioLiberacao) { formData.documentReleaseTime = parsed.horarioLiberacao; filledFields.push('documentReleaseTime'); }
      else { missingFields.push('documentReleaseTime'); }

      // Blockage
      if (parsed.bloqueio) { formData.blockageStatus = parsed.bloqueio; filledFields.push('blockageStatus'); }
      else { missingFields.push('blockageStatus'); }

      // Activities
      if (parsed.atividades && parsed.atividades.length > 0) {
        formData.activities = parsed.atividades.map((desc, index): Activity => ({
          id: `ai-${Date.now()}-${index}`,
          reportId: '',
          description: desc,
          completed: desc.includes('✅') || desc.toLowerCase().includes('finalizada'),
          order: index,
        }));
        filledFields.push('activities');
      } else { missingFields.push('activities'); }

      // Attendance
      if (parsed.efetivo && parsed.efetivo.length > 0) {
        const normalizedEfetivo = parsed.efetivo
          .map(item => {
            if (typeof item === 'string') return { nome: item, funcao: null as string | null, presente: true };
            return {
              nome: String(item.nome || ''),
              funcao: item.funcao || null,
              presente: item.presente === false ? false : true,
            };
          })
          // Ignora linhas sem nome (ex.: "9.N1-✅")
          .filter(item => item.nome && item.nome.trim().length > 1);
        
        formData.attendance = normalizedEfetivo.map((item, index): Attendance => {
          const matchedTeamMember = matchCollaborator(item.nome, teamMembers.map(m => ({ id: m.id, name: m.name })));
          const matchedProfile = matchedTeamMember || matchCollaborator(item.nome, allProfiles);
          
          if (matchedProfile) {
            matchedCollaborators.push(matchedProfile.name || item.nome);
          } else {
            unmatchedCollaborators.push(item.nome);
          }

          const matchedFullProfile = allProfiles.find(p => p.id === matchedProfile?.id);
          const functionRole = item.funcao || matchedFullProfile?.jobTitle || 'Convencional';
          
          return {
            id: `ai-attendance-${Date.now()}-${index}`,
            reportId: '',
            userId: matchedProfile?.id || null,
            userName: matchedProfile?.name || item.nome,
            present: item.presente,
            arrivalTime: item.presente ? (parsed.horaInicio || '') : '',
            departureTime: item.presente ? (parsed.horaFim || '') : '',
            functionRole,
          };
        });
        filledFields.push('attendance');
      } else { missingFields.push('attendance'); }

      // Ambulance/Meeting
      if (parsed.pontoAmbulancia) { formData.ambulancePoint = parsed.pontoAmbulancia; filledFields.push('ambulancePoint'); }
      else { missingFields.push('ambulancePoint'); }
      if (parsed.pontoEncontro) { formData.meetingPoint = parsed.pontoEncontro; filledFields.push('meetingPoint'); }
      else { missingFields.push('meetingPoint'); }

      // Block revalidation
      if (parsed.horarioRevalidacaoBloqueio) { formData.blockRevalidationTime = parsed.horarioRevalidacaoBloqueio; filledFields.push('blockRevalidationTime'); }
      else { missingFields.push('blockRevalidationTime'); }

      // Deviations
      if (parsed.desvios && parsed.desvios.length > 0) {
        const mapType = (tipo: string): DeviationType => {
          const t = tipo?.toLowerCase() || '';
          if (t.includes('atraso') || t.includes('delay')) return 'delay';
          if (t.includes('equip') || t.includes('equipment')) return 'equipment';
          if (t.includes('segur') || t.includes('safety')) return 'safety';
          return 'other';
        };
        const mapImpact = (impacto: string): ImpactLevel => {
          const i = impacto?.toLowerCase() || '';
          if (i.includes('alto') || i.includes('high') || i.includes('crítico')) return 'high';
          if (i.includes('médio') || i.includes('medium') || i.includes('moderado')) return 'medium';
          return 'low';
        };
        formData.deviations = parsed.desvios.map((d, index): Deviation => ({
          id: `ai-deviation-${Date.now()}-${index}`,
          reportId: '',
          description: d.descricao || '',
          type: mapType(d.tipo),
          impact: mapImpact(d.impacto),
          correctiveAction: d.acaoCorretiva || '',
          resolved: false,
        }));
        filledFields.push('deviations');
      } else { missingFields.push('deviations'); }

      // Comments
      if (parsed.comentarios) { formData.comments = parsed.comentarios; filledFields.push('comments'); }
      else { missingFields.push('comments'); }

      // Supervisor
      if (parsed.supervisor) { formData.supervisorName = parsed.supervisor; filledFields.push('supervisorName'); }
      else { missingFields.push('supervisorName'); }

      // Responsável Técnico
      if (parsed.responsavelTecnico) { formData.technicalResponsibleName = parsed.responsavelTecnico; filledFields.push('technicalResponsibleName'); }
      else { missingFields.push('technicalResponsibleName'); }

      console.log(`[ParseReportModal] Resultado: ${filledFields.length}/${ALL_TRACKABLE_FIELDS.length} campos, ${matchedCollaborators.length} colaboradores encontrados`);
      if (unmatchedCollaborators.length > 0) {
        console.log(`[ParseReportModal] Não encontrados: ${unmatchedCollaborators.join(', ')}`);
      }

      setParseResult({ formData, filledFields, missingFields, matchedCollaborators, unmatchedCollaborators });

    } catch (error) {
      console.error('Error parsing report:', error);
      const message = error instanceof Error ? error.message : 'Tente novamente ou preencha manualmente.';
      toast({
        title: 'Erro ao interpretar',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setParseResult(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ClipboardPaste className="h-4 w-4" />
          <span className="hidden sm:inline">Colar Relatório do WhatsApp</span>
          <span className="sm:hidden">Colar WhatsApp</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            Colar Relatório do WhatsApp
          </DialogTitle>
        </DialogHeader>

        {parseResult ? (
          /* ===== POST-PARSING RESULT VIEW ===== */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Resultado da interpretação. Revise e clique em "Aplicar" para preencher o formulário.
            </p>

            {/* Filled fields */}
            {parseResult.filledFields.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground uppercase tracking-wide">Campos preenchidos</p>
                <div className="flex flex-wrap gap-1.5">
                  {parseResult.filledFields.map(field => (
                    <span key={field} className="inline-flex items-center gap-1 rounded-full border border-emerald-400 dark:border-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                      <CheckCircle2 className="h-3 w-3" />
                      {FIELD_LABELS[field] || field}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Missing fields */}
            {parseResult.missingFields.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground uppercase tracking-wide">Não encontrados</p>
                <div className="flex flex-wrap gap-1.5">
                  {parseResult.missingFields.map(field => (
                    <span key={field} className="inline-flex items-center gap-1 rounded-full border border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/50 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:text-amber-100">
                      <AlertTriangle className="h-3 w-3" />
                      {FIELD_LABELS[field] || field}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Collaborators */}
            {(parseResult.matchedCollaborators.length > 0 || parseResult.unmatchedCollaborators.length > 0) && (
              <div className="space-y-2 rounded-lg border-2 border-border bg-muted/30 p-3">
                <p className="text-sm font-bold text-foreground">
                  👥 Colaboradores ({parseResult.matchedCollaborators.length}/{parseResult.matchedCollaborators.length + parseResult.unmatchedCollaborators.length} identificados)
                </p>
                {parseResult.matchedCollaborators.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {parseResult.matchedCollaborators.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md border border-emerald-400 dark:border-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                        <CheckCircle2 className="h-3 w-3" /> {name}
                      </span>
                    ))}
                  </div>
                )}
                {parseResult.unmatchedCollaborators.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {parseResult.unmatchedCollaborators.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md border border-red-400 dark:border-red-600 bg-red-100 dark:bg-red-900/50 px-2 py-1 text-sm font-semibold text-red-900 dark:text-red-100">
                        <AlertTriangle className="h-3 w-3" /> {name}
                      </span>
                    ))}
                  </div>
                )}
                {parseResult.unmatchedCollaborators.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ⚠️ Colaboradores não encontrados serão adicionados com os nomes do texto. Verifique se estão cadastrados no sistema.
                  </p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleRetry} className="flex-1 gap-2">
                <RotateCcw className="h-4 w-4" />
                Tentar novamente
              </Button>
              <Button onClick={handleApply} className="flex-1 gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Aplicar
              </Button>
            </div>
          </div>
        ) : (
          /* ===== INPUT VIEW ===== */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cole o relatório copiado do WhatsApp abaixo. A IA vai interpretar e preencher os campos automaticamente.
            </p>

            {/* Tips collapsible */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                <span>Dicas para melhor reconhecimento</span>
                <ChevronDown className="h-3 w-3 ml-auto transition-transform [[data-state=open]_&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5 text-xs text-muted-foreground">
                  <p>• Liste colaboradores como: <strong>Nome - Função</strong> ou <strong>Função - Nome</strong></p>
                  <p>• Use formatos claros de data: <strong>DD/MM/YYYY</strong></p>
                  <p>• Horários aceitos: <strong>07:00</strong>, <strong>7h</strong>, <strong>07h30</strong></p>
                  <p>• Separe seções com títulos como: <strong>Efetivo:</strong>, <strong>Atividades:</strong>, <strong>Desvios:</strong></p>
                  <p>• Abreviações reconhecidas: <strong>Mec.</strong>, <strong>Elet.</strong>, <strong>Sold.</strong>, <strong>Eng.</strong>, <strong>Sup.</strong></p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="relative">
              <Textarea
                placeholder="*Relatório Diário de Obra - Cliente&#10;📆 Data: 18/12/2025&#10;Turno do dia&#10;👷🏽 Supervisor: Nome&#10;📍 Local da atividade: Local&#10;⏱️ Período de trabalho: 07:00 às 14:00..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[200px] pr-10 text-sm"
              />
              {text && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => setText('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePaste}
                className="flex-1 gap-2"
              >
                <ClipboardPaste className="h-4 w-4" />
                Colar da Área de Transferência
              </Button>
            </div>

            <Button
              onClick={handleParse}
              disabled={isLoading || !text.trim()}
              className="w-full gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Interpretando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Interpretar com IA
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              A IA vai extrair: data, turno, local, horários, segurança, documentação, atividades, desvios, efetivo e comentários.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
