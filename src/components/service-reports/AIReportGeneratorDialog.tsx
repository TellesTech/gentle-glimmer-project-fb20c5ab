import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Building2, FolderKanban, FileText, Camera, AlertCircle, Clock, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { useGenerationProgress } from '@/hooks/useGenerationProgress';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

const CLIENT_TIMEOUT_MS = 150_000; // 150s — function itself caps AI at 120s

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId?: string;
  siteId?: string;
  projectId?: string;
  onGenerated?: () => void;
}

export function AIReportGeneratorDialog({ open, onOpenChange, reportId, siteId: initialSiteId, projectId: initialProjectId, onGenerated }: Props) {
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();
  const [selectedSiteId, setSelectedSiteId] = useState(initialSiteId || '');
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '');
  const [generating, setGenerating] = useState(false);
  const { progress, elapsedLabel, start, complete, reset: resetProgress, setProgress } = useGenerationProgress({ cap: 90, tickMs: 1500, stepPercent: 1 });
  const [step, setStep] = useState<'select' | 'generating' | 'error'>('select');
  const [errorMsg, setErrorMsg] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  // Fetch sites — restricted to the units the user has access to
  // (portal_admin_access + site_responsibles). Super_admin sees all.
  const { data: sites } = useQuery({
    queryKey: ['sites-ai-gen', user?.id, role, profile?.company_id],
    queryFn: async () => {
      const isSuper = role === 'super_admin';

      if (isSuper) {
        const query = supabase.from('sites').select('id, name, city, state').order('name');
        if (profile?.company_id) query.eq('company_id', profile.company_id);
        const { data } = await query;
        return data || [];
      }

      const [paaRes, srRes] = await Promise.all([
        supabase.from('portal_admin_access').select('site_id').eq('user_id', user!.id),
        supabase.from('site_responsibles').select('site_id').eq('user_id', user!.id),
      ]);
      const allowedIds = Array.from(new Set([
        ...((paaRes.data || []).map((r: any) => r.site_id as string)),
        ...((srRes.data || []).map((r: any) => r.site_id as string)),
      ]));

      if (allowedIds.length === 0) return [];

      const { data } = await supabase
        .from('sites')
        .select('id, name, city, state')
        .in('id', allowedIds)
        .order('name');
      return data || [];
    },
    enabled: !!user && open,
  });

  // Fetch projects for selected site
  const { data: projects } = useQuery({
    queryKey: ['projects-ai-gen', selectedSiteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, start_date, end_date, progress, status')
        .eq('site_id', selectedSiteId)
        .order('name');
      return data || [];
    },
    enabled: !!selectedSiteId,
  });

  // Fetch project stats (respeita período se informado)
  const { data: projectStats } = useQuery({
    queryKey: ['project-stats-ai-gen', selectedProjectId, periodStart, periodEnd],
    queryFn: async () => {
      let reportsQ = supabase
        .from('reports')
        .select('id', { count: 'exact' })
        .eq('project_id', selectedProjectId);
      if (periodStart) reportsQ = reportsQ.gte('date', periodStart);
      if (periodEnd) reportsQ = reportsQ.lte('date', periodEnd);
      const { data: reportRows, count: rdoCount } = await reportsQ;

      const ids = (reportRows || []).map((r: any) => r.id);
      let photoCount = 0;
      if (ids.length > 0) {
        const { count } = await supabase
          .from('report_photos')
          .select('*', { count: 'exact', head: true })
          .in('report_id', ids);
        photoCount = count || 0;
      }
      return { rdos: rdoCount || 0, photos: photoCount };
    },
    enabled: !!selectedProjectId,
  });

  const selectedProject = projects?.find(p => p.id === selectedProjectId);

  const periodInvalid = !!(periodStart && periodEnd && periodStart > periodEnd);

  const handleGenerate = async () => {
    if (!selectedProjectId || !selectedSiteId || periodInvalid) return;

    setStep('generating');
    setGenerating(true);
    start();

    // Client-side timeout via Promise.race — Supabase invoke does not honour AbortController consistently
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT_CLIENT')), CLIENT_TIMEOUT_MS);
    });

    try {
      const invokePromise = supabase.functions.invoke('generate-service-report', {
        body: {
          project_id: selectedProjectId,
          site_id: selectedSiteId,
          period_start: periodStart || null,
          period_end: periodEnd || null,
        },
      });
      const { data: fnData, error: fnError } = await Promise.race([invokePromise, timeoutPromise]) as any;

      if (fnError) throw new Error(fnError.message || 'Erro na geração');
      if (fnData?.error) throw new Error(fnData.error);

      setProgress(75);
      const report = fnData.report;

      // Step 2: Create or update service_report
      let finalReportId: string;

      if (reportId) {
        // Update existing report
        const { error: updateErr } = await supabase
          .from('service_reports')
          .update({
            client_name: report.client_name,
            client_unit: report.client_unit,
            client_contact: report.client_contact,
            scope_description: report.scope_description,
            start_date: report.start_date,
            end_date: report.end_date,
            safety_notes: report.safety_notes,
            conclusion: report.conclusion,
          })
          .eq('id', reportId);
        if (updateErr) throw updateErr;

        // Delete existing sections/photos
        const { data: existingSections } = await supabase
          .from('service_report_sections')
          .select('id')
          .eq('report_id', reportId);
        if (existingSections?.length) {
          await supabase.from('service_report_photos').delete().in('section_id', existingSections.map(s => s.id));
          await supabase.from('service_report_sections').delete().eq('report_id', reportId);
        }
        finalReportId = reportId;
      } else {
        // Resolve company_id from the selected site (not from the user's profile,
        // which can differ for super_admins or be null).
        const { data: siteRow, error: siteErr } = await supabase
          .from('sites')
          .select('company_id')
          .eq('id', selectedSiteId)
          .maybeSingle();
        if (siteErr) throw siteErr;
        const resolvedCompanyId = siteRow?.company_id || profile?.company_id;

        // Create new report
        const { data: newReport, error: createErr } = await supabase
          .from('service_reports')
          .insert({
            title: `Relatório - ${report.client_name} - ${report.client_unit} - ${selectedProject?.name || ''}`,
            company_id: resolvedCompanyId,
            site_id: selectedSiteId,
            project_id: selectedProjectId,
            client_name: report.client_name,
            client_unit: report.client_unit,
            client_contact: report.client_contact,
            subject: selectedProject?.name || '',
            scope_description: report.scope_description,
            start_date: report.start_date,
            end_date: report.end_date,
            safety_notes: report.safety_notes,
            conclusion: report.conclusion,
            status: 'draft' as any,
            created_by: user!.id,
          })
          .select('id')
          .single();
        if (createErr) throw createErr;
        finalReportId = newReport.id;
      }

      setProgress(75);

      // Step 3: Create sections with subsections support
      let orderIdx = 0;
      const sectionsToInsert: any[] = [];
      const photoUrlsMap: string[][] = [];

      // 3. Escopo
      sectionsToInsert.push({
        report_id: finalReportId, title: 'Escopo dos Serviços', section_type: 'scope' as const,
        order_index: orderIdx++, content: [{ type: 'paragraph' as const, text: report.scope_description }],
      });
      photoUrlsMap.push([]);

      // 4. Segurança
      sectionsToInsert.push({
        report_id: finalReportId, title: 'Segurança do Trabalho', section_type: 'safety' as const,
        order_index: orderIdx++, content: [{ type: 'paragraph' as const, text: report.safety_notes }],
      });
      photoUrlsMap.push([]);

      // 5. Execução - main sections + subsections flattened
      for (const sec of (report.execution_sections || []) as any[]) {
        sectionsToInsert.push({
          report_id: finalReportId, title: sec.title, section_type: 'execution' as const,
          order_index: orderIdx++, content: [{ type: 'paragraph' as const, text: sec.content }],
        });
        photoUrlsMap.push(sec.photo_urls || []);

        for (const sub of (sec.subsections || []) as any[]) {
          sectionsToInsert.push({
            report_id: finalReportId, title: `  ${sub.title}`, section_type: 'execution' as const,
            order_index: orderIdx++, content: [{ type: 'paragraph' as const, text: sub.content }],
          });
          photoUrlsMap.push(sub.photo_urls || []);
        }
      }

      // 6. Atividades Fora do Escopo
      for (const oos of (report.out_of_scope_sections || []) as any[]) {
        sectionsToInsert.push({
          report_id: finalReportId, title: oos.title, section_type: 'custom' as const,
          order_index: orderIdx++, content: [
            { type: 'heading' as const, text: 'Atividade Fora do Escopo' },
            { type: 'paragraph' as const, text: oos.content },
          ],
        });
        photoUrlsMap.push(oos.photo_urls || []);
      }

      // 7. Conclusão + Recomendações (deduplicadas vs. conclusion)
      const normalizeRec = (s: string) =>
        (s || '')
          .replace(/<[^>]+>/g, '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      const concNorm = normalizeRec(report.conclusion || '');
      const concWords = new Set(
        concNorm.split(' ').filter((w) => w.length > 3),
      );

      // Quebrar recomendações compostas (frases coladas sem espaço após ponto)
      // e também itens que vêm como string única separados por '\n' / ';'
      const rawRecs: string[] = Array.isArray(report.recommendations)
        ? (report.recommendations as string[]).flatMap((r) => {
            const s = (r || '').toString();
            // separa por nova linha, ponto-e-vírgula ou ponto seguido de letra maiúscula sem espaço
            return s
              .split(/\n+|;|(?<=\.)(?=[A-ZÀ-Ý])/g)
              .map((p) => p.trim())
              .filter(Boolean);
          })
        : [];

      const seenRecs = new Set<string>();
      const uniqueRecs = rawRecs.filter((r) => {
        const rn = normalizeRec(r);
        if (!rn || rn.length < 8) return false;
        if (seenRecs.has(rn)) return false;
        // descarta se já está dentro da conclusion
        if (rn === concNorm) return false;
        if (concNorm.includes(rn)) return false;
        // descarta se a rec ENGLOBA toda a conclusion (caso da imagem do usuário)
        if (rn.includes(concNorm) && concNorm.length > 30) return false;
        // similaridade por interseção de palavras significativas
        if (concWords.size > 0) {
          const recWords = rn.split(' ').filter((w) => w.length > 3);
          if (recWords.length > 0) {
            const overlap = recWords.filter((w) => concWords.has(w)).length;
            if (overlap / recWords.length >= 0.7) return false;
          }
        }
        seenRecs.add(rn);
        return true;
      });

      const conclusionBlocks: any[] = [{ type: 'paragraph' as const, text: report.conclusion }];
      if (uniqueRecs.length) {
        conclusionBlocks.push({ type: 'heading' as const, text: 'Recomendações' });
        // Salva recomendações como itens separados por nova linha em texto puro
        // (sem HTML <p>), garantindo que o gerador de PDF as renderize uma a uma.
        const recsPlain = uniqueRecs
          .map((r) => (r || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .join('\n');
        conclusionBlocks.push({ type: 'list' as const, text: recsPlain });
      }
      sectionsToInsert.push({
        report_id: finalReportId, title: 'Conclusão e Recomendações', section_type: 'conclusion' as const,
        order_index: orderIdx++, content: conclusionBlocks,
      });
      photoUrlsMap.push([]);

      const { data: createdSections, error: secErr } = await supabase
        .from('service_report_sections')
        .insert(sectionsToInsert)
        .select('id, order_index');

      if (secErr) throw secErr;
      setProgress(85);

      // Step 4: Add photos — defaults técnicos seguros (grade 2 col, sem altura customizada).
      const photosToInsert: any[] = [];
      (createdSections || []).forEach((dbSec: any) => {
        const urls = photoUrlsMap[dbSec.order_index] || [];
        urls.slice(0, 6).forEach((url: string, photoIdx: number) => {
          photosToInsert.push({
            section_id: dbSec.id, url, caption: '',
            layout: 'half' as const,
            width_percent: 50,
            custom_height: null,
            object_fit: 'contain',
            order_index: photoIdx, annotations: [],
          });
        });
      });

      if (photosToInsert.length > 0) {
        await supabase.from('service_report_photos').insert(photosToInsert);
      }

      complete();
      toast.success('Relatório gerado com sucesso pela IA!');

      setTimeout(() => {
        onOpenChange(false);
        if (reportId) {
          onGenerated?.();
        } else {
          navigate(`/service-reports/${finalReportId}/edit`);
        }
      }, 500);

    } catch (err: any) {
      console.error('AI generation error:', err);
      const isTimeout = err?.message === 'TIMEOUT_CLIENT';
      const rawMsg: string = err?.message || '';
      const isRls = /row-level security|violates row-level|permission denied|42501/i.test(rawMsg);
      const friendly = isTimeout
        ? 'A geração demorou mais que o esperado (>150s). Tente novamente — projetos com muitos RDOs podem exigir mais tempo.'
        : isRls
          ? 'Você não tem permissão para gerar relatório nesta unidade. Verifique se a unidade está liberada para seu usuário.'
          : (rawMsg || 'Erro ao gerar relatório');
      setErrorMsg(friendly);
      setStep('error');

      if (isTimeout) {
        toast.error('Tempo esgotado ao gerar relatório.');
      } else if (isRls) {
        toast.error('Sem permissão para gerar relatório nesta unidade.');
      } else if (rawMsg.includes('429') || rawMsg.includes('Limite')) {
        toast.error('Limite de requisições excedido. Tente novamente em alguns minutos.');
      } else if (rawMsg.includes('402') || rawMsg.includes('Créditos')) {
        toast.error('Créditos insuficientes para IA.');
      } else {
        toast.error('Erro ao gerar relatório: ' + rawMsg);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setStep('select');
    resetProgress();
    setErrorMsg('');
    setPeriodStart('');
    setPeriodEnd('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!generating) { if (v) { setSelectedSiteId(initialSiteId || ''); setSelectedProjectId(initialProjectId || ''); setPeriodStart(''); setPeriodEnd(''); } onOpenChange(v); handleReset(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gerar Relatório com IA
          </DialogTitle>
          <DialogDescription>
            A IA coleta dados dos RDOs, fotos e resumos para gerar um relatório completo automaticamente.
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4 pt-2">
            {/* Site selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Building2 className="w-4 h-4" />
                Unidade
              </Label>
              <Select value={selectedSiteId} onValueChange={(v) => { setSelectedSiteId(v); setSelectedProjectId(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade..." />
                </SelectTrigger>
                <SelectContent>
                  {sites?.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.city ? `- ${s.city}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project selector */}
            {selectedSiteId && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <FolderKanban className="w-4 h-4" />
                  Projeto / Atividade
                </Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o projeto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Period selector */}
            {selectedProjectId && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <CalendarRange className="w-4 h-4" />
                  Período do relatório
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="period-start" className="text-xs text-muted-foreground font-normal">Data inicial</Label>
                    <Input
                      id="period-start"
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="period-end" className="text-xs text-muted-foreground font-normal">Data final</Label>
                    <Input
                      id="period-end"
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button
                    type="button" variant="outline" size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const today = new Date();
                      setPeriodStart(format(subDays(today, 30), 'yyyy-MM-dd'));
                      setPeriodEnd(format(today, 'yyyy-MM-dd'));
                    }}
                  >Últimos 30 dias</Button>
                  <Button
                    type="button" variant="outline" size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const today = new Date();
                      setPeriodStart(format(startOfMonth(today), 'yyyy-MM-dd'));
                      setPeriodEnd(format(endOfMonth(today), 'yyyy-MM-dd'));
                    }}
                  >Este mês</Button>
                  {selectedProject?.start_date && selectedProject?.end_date && (
                    <Button
                      type="button" variant="outline" size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setPeriodStart(selectedProject.start_date as string);
                        setPeriodEnd(selectedProject.end_date as string);
                      }}
                    >Período do projeto</Button>
                  )}
                  {(periodStart || periodEnd) && (
                    <Button
                      type="button" variant="ghost" size="sm"
                      className="h-7 text-xs"
                      onClick={() => { setPeriodStart(''); setPeriodEnd(''); }}
                    >Limpar</Button>
                  )}
                </div>
                {periodInvalid ? (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Data final deve ser posterior à inicial.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Deixe em branco para incluir todos os RDOs do projeto.
                  </p>
                )}
              </div>
            )}

            {/* Project stats summary */}
            {selectedProjectId && projectStats && (
              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">
                  {(periodStart || periodEnd) ? 'Dados disponíveis no período selecionado:' : 'Dados disponíveis para a IA:'}
                </p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>{projectStats.rdos}</strong> RDOs
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>{projectStats.photos}</strong> Fotos
                    </span>
                  </div>
                </div>
                {selectedProject && (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {selectedProject.start_date && <Badge variant="outline">Início: {selectedProject.start_date}</Badge>}
                    {selectedProject.end_date && <Badge variant="outline">Fim: {selectedProject.end_date}</Badge>}
                    <Badge variant="outline">Progresso: {selectedProject.progress || 0}%</Badge>
                  </div>
                )}
                {projectStats.rdos === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {(periodStart || periodEnd)
                      ? 'Nenhum RDO encontrado neste período. Ajuste as datas ou limpe o filtro.'
                      : 'Nenhum RDO encontrado. O relatório pode ficar genérico.'}
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!selectedProjectId || !selectedSiteId || periodInvalid}
              className="w-full gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Gerar Relatório com IA
            </Button>
          </div>
        )}

        {step === 'generating' && (
          <div className="space-y-4 py-6">
            <div className="text-center space-y-2">
              <div className="animate-pulse">
                <Sparkles className="w-10 h-10 text-primary mx-auto" />
              </div>
              <p className="text-sm font-medium text-foreground">Gerando relatório...</p>
              <p className="text-xs text-muted-foreground">
                {progress < 30 ? 'Coletando dados dos RDOs e fotos...' :
                 progress < 60 ? 'IA analisando atividades e escopo...' :
                 progress < 85 ? 'Montando seções e selecionando fotos...' :
                 'Finalizando relatório...'}
              </p>
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 justify-center">
                <Clock className="w-3 h-3" /> Tempo decorrido: {elapsedLabel}
              </p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
              <p className="text-sm font-medium text-foreground">Erro na geração</p>
              <p className="text-xs text-muted-foreground">{errorMsg}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">Voltar</Button>
              <Button onClick={handleGenerate} className="flex-1 gap-1">
                <Sparkles className="w-4 h-4" />
                Tentar novamente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
