import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, AlertCircle, FileEdit, Eye, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useGenerationProgress } from '@/hooks/useGenerationProgress';

const CLIENT_TIMEOUT_MS = 150_000;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  siteId: string;
  reportId: string; // the RDO that triggered this
}

export function AutoServiceReportDialog({ open, onOpenChange, projectId, siteId, reportId }: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [step, setStep] = useState<'generating' | 'done' | 'error'>('generating');
  const { progress, elapsedLabel, start, complete, reset: resetProgress, setProgress } = useGenerationProgress({ cap: 90, tickMs: 1500, stepPercent: 1 });
  const [errorMsg, setErrorMsg] = useState('');
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);

  useEffect(() => {
    if (open && step === 'generating') {
      handleGenerate();
    }
  }, [open]);

  const handleGenerate = async () => {
    setStep('generating');
    start();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT_CLIENT')), CLIENT_TIMEOUT_MS);
    });

    try {
      const invokePromise = supabase.functions.invoke('generate-service-report', {
        body: { project_id: projectId, site_id: siteId },
      });
      const { data: fnData, error: fnError } = await Promise.race([invokePromise, timeoutPromise]) as any;

      if (fnError) throw new Error(fnError.message || 'Erro na geração');
      if (fnData?.error) throw new Error(fnData.error);

      setProgress(70);
      const report = fnData.report;

      // Fetch project name and resolve company_id from the site
      const [{ data: projectData }, { data: siteRow }] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).single(),
        supabase.from('sites').select('company_id').eq('id', siteId).maybeSingle(),
      ]);
      const resolvedCompanyId = siteRow?.company_id || profile?.company_id;

      // Create service_report
      const { data: newReport, error: createErr } = await supabase
        .from('service_reports')
        .insert({
          title: `Relatório - ${report.client_name} - ${report.client_unit} - ${projectData?.name || ''}`,
          company_id: resolvedCompanyId,
          site_id: siteId,
          project_id: projectId,
          client_name: report.client_name,
          client_unit: report.client_unit,
          client_contact: report.client_contact,
          subject: projectData?.name || '',
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
      const finalReportId = newReport.id;

      setProgress(75);

      // Create sections
      let orderIdx = 0;
      const sectionsToInsert: any[] = [];
      const photoUrlsMap: string[][] = [];

      sectionsToInsert.push({
        report_id: finalReportId, title: 'Escopo dos Serviços', section_type: 'scope' as const,
        order_index: orderIdx++, content: [{ id: crypto.randomUUID(), type: 'paragraph' as const, text: report.scope_description }],
      });
      photoUrlsMap.push([]);

      sectionsToInsert.push({
        report_id: finalReportId, title: 'Segurança do Trabalho', section_type: 'safety' as const,
        order_index: orderIdx++, content: [{ id: crypto.randomUUID(), type: 'paragraph' as const, text: report.safety_notes }],
      });
      photoUrlsMap.push([]);

      // New: Resources section
      if (report.resources_section) {
        sectionsToInsert.push({
          report_id: finalReportId, title: 'Mobilização de Recursos', section_type: 'custom' as const,
          order_index: orderIdx++, content: [{ id: crypto.randomUUID(), type: 'paragraph' as const, text: report.resources_section }],
        });
        photoUrlsMap.push([]);
      }

      // New: Schedule summary section
      if (report.schedule_summary) {
        sectionsToInsert.push({
          report_id: finalReportId, title: 'Cronograma Executivo', section_type: 'custom' as const,
          order_index: orderIdx++, content: [{ id: crypto.randomUUID(), type: 'paragraph' as const, text: report.schedule_summary }],
        });
        photoUrlsMap.push([]);
      }

      for (const sec of (report.execution_sections || []) as any[]) {
        sectionsToInsert.push({
          report_id: finalReportId, title: sec.title, section_type: 'execution' as const,
          order_index: orderIdx++, content: [{ id: crypto.randomUUID(), type: 'paragraph' as const, text: sec.content }],
        });
        photoUrlsMap.push(sec.photo_urls || []);

        for (const sub of (sec.subsections || []) as any[]) {
          sectionsToInsert.push({
            report_id: finalReportId, title: `  ${sub.title}`, section_type: 'execution' as const,
            order_index: orderIdx++, content: [{ id: crypto.randomUUID(), type: 'paragraph' as const, text: sub.content }],
          });
          photoUrlsMap.push(sub.photo_urls || []);
        }
      }

      for (const oos of (report.out_of_scope_sections || []) as any[]) {
        sectionsToInsert.push({
          report_id: finalReportId, title: oos.title, section_type: 'custom' as const,
          order_index: orderIdx++, content: [
            { id: crypto.randomUUID(), type: 'heading' as const, text: 'Atividade Fora do Escopo' },
            { id: crypto.randomUUID(), type: 'paragraph' as const, text: oos.content },
          ],
        });
        photoUrlsMap.push(oos.photo_urls || []);
      }

      // Build conclusion blocks — drop recommendations that simply repeat the
      // conclusion text (the AI sometimes echoes the same paragraph back).
      const normalize = (s: string) =>
        (s || '')
          .replace(/<[^>]+>/g, '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      const conclusionNorm = normalize(report.conclusion || '');
      const uniqueRecs = Array.isArray(report.recommendations)
        ? (report.recommendations as string[])
            .filter((r) => {
              const rn = normalize(r);
              return rn && rn !== conclusionNorm && !conclusionNorm.includes(rn);
            })
        : [];
      const conclusionBlocks: any[] = [{ id: crypto.randomUUID(), type: 'paragraph' as const, text: report.conclusion }];
      if (uniqueRecs.length) {
        conclusionBlocks.push({ id: crypto.randomUUID(), type: 'heading' as const, text: 'Recomendações' });
        conclusionBlocks.push({ id: crypto.randomUUID(), type: 'list' as const, text: uniqueRecs.join('\n') });
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

      // Add photos — DEFAULT TECHNICAL GRID (no oversized custom heights).
      // The PDF/Preview renderer auto-computes a safe height from a strict
      // 2-column grid; saving custom_height/width_percent here just causes
      // distortion and overlap on export.
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
      setGeneratedReportId(finalReportId);
      setStep('done');
      toast.success('Relatório de Serviço gerado automaticamente pela IA!');
    } catch (err: any) {
      console.error('Auto AI generation error:', err);
      const isTimeout = err?.message === 'TIMEOUT_CLIENT';
      const friendly = isTimeout
        ? 'A geração demorou mais que o esperado (>150s). Tente novamente — projetos com muitos RDOs podem exigir mais tempo.'
        : (err.message || 'Erro ao gerar relatório');
      setErrorMsg(friendly);
      setStep('error');

      if (isTimeout) {
        toast.error('Tempo esgotado ao gerar relatório.');
      } else if (err.message?.includes('429') || err.message?.includes('Limite')) {
        toast.error('Limite de requisições excedido. Tente novamente em alguns minutos.');
      } else if (err.message?.includes('402') || err.message?.includes('Créditos')) {
        toast.error('Créditos insuficientes para IA.');
      } else {
        toast.error('Erro ao gerar relatório automático');
      }
    }
  };

  const handleEdit = () => {
    onOpenChange(false);
    if (generatedReportId) {
      navigate(`/service-reports/${generatedReportId}/edit`);
    }
  };

  const handleViewLater = () => {
    onOpenChange(false);
    navigate(`/reports/${reportId}`, { replace: true });
  };

  const handleRetry = () => {
    setStep('generating');
    resetProgress();
    setErrorMsg('');
    handleGenerate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (step !== 'generating') onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => { if (step === 'generating') e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Relatório de Serviço Automático
          </DialogTitle>
          <DialogDescription>
            O projeto atingiu 100% de progresso! A IA está gerando o relatório final.
          </DialogDescription>
        </DialogHeader>

        {step === 'generating' && (
          <div className="space-y-4 py-6">
            <div className="text-center space-y-2">
              <div className="animate-pulse">
                <Sparkles className="w-10 h-10 text-primary mx-auto" />
              </div>
              <p className="text-sm font-medium text-foreground">Gerando relatório de serviço...</p>
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

        {step === 'done' && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Relatório gerado com sucesso!</p>
              <p className="text-xs text-muted-foreground">
                Você pode editar o relatório agora ou visualizar depois.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleViewLater} className="flex-1 gap-1.5">
                <Eye className="w-4 h-4" />
                Ver Depois
              </Button>
              <Button onClick={handleEdit} className="flex-1 gap-1.5">
                <FileEdit className="w-4 h-4" />
                Editar Relatório
              </Button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
              <p className="text-sm font-medium text-foreground">Erro na geração automática</p>
              <p className="text-xs text-muted-foreground">{errorMsg}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleViewLater} className="flex-1">
                Ir para o RDO
              </Button>
              <Button onClick={handleRetry} className="flex-1 gap-1">
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
