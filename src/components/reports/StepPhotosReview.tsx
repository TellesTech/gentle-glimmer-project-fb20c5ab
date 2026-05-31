import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Camera, FileText, Calendar, MapPin, Clock, Users, 
  AlertTriangle, CheckCircle2, Building2, Sparkles, Loader2
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PhotoUploader } from '@/components/shared';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AISummaryPreviewDialog } from './AISummaryPreviewDialog';
import type { ReportFormData } from '@/pages/ReportForm';
import type { Project, Team } from '@/types';

interface StepPhotosReviewProps {
  data: ReportFormData;
  onChange: (data: Partial<ReportFormData>) => void;
  projects: Project[];
  teams: Team[];
}

const shiftLabels: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
};

export function StepPhotosReview({ data, onChange, projects, teams }: StepPhotosReviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  
  const project = projects.find(p => p.id === data.projectId);
  const team = teams.find(t => t.id === data.teamId);

  const generateSummary = async (): Promise<string | null> => {
    try {
      const { data: result, error } = await supabase.functions.invoke('generate-report-summary', {
        body: {
          activities: data.activities,
          deviations: data.deviations,
          attendance: data.attendance,
          date: typeof data.date === 'string' ? format(parseISO(data.date), 'dd/MM/yyyy') : format(data.date, 'dd/MM/yyyy'),
          shift: data.shift,
          projectName: project?.name,
        },
      });

      if (error) {
        console.error('[StepPhotosReview] Error:', error);
        toast.error('Erro ao gerar resumo');
        return null;
      }

      if (result?.summary) {
        return result.summary;
      } else if (result?.error) {
        toast.error(result.error);
        return null;
      }
      
      return null;
    } catch (err) {
      console.error('[StepPhotosReview] Error:', err);
      toast.error('Erro ao conectar com a IA');
      return null;
    }
  };

  const handleGenerateSummary = async () => {
    if (data.activities.length === 0) {
      toast.warning('Adicione pelo menos uma atividade antes de gerar o resumo');
      return;
    }

    setIsGenerating(true);
    const summary = await generateSummary();
    setIsGenerating(false);
    
    if (summary) {
      setGeneratedText(summary);
      setPreviewOpen(true);
    }
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    const summary = await generateSummary();
    setIsGenerating(false);
    
    if (summary) {
      setGeneratedText(summary);
    }
  };

  const handleAcceptSummary = (text: string) => {
    onChange({ aiSummary: text });
    toast.success('Resumo aplicado com sucesso!');
  };

  return (
    <div className="space-y-6">
      {/* Photos */}
      <div>
        <Label className="flex items-center gap-2 mb-3">
          <Camera className="h-4 w-4" />
          Fotos da Atividade
        </Label>
        <PhotoUploader
          photos={data.photos}
          onPhotosChange={(photos) => onChange({ photos })}
          maxPhotos={10}
        />
      </div>

      {/* Comments */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Observações Gerais
        </Label>
        <Textarea
          value={data.comments}
          onChange={(e) => onChange({ comments: e.target.value })}
          placeholder="Adicione comentários ou observações sobre o dia de trabalho..."
          rows={4}
        />
      </div>

      {/* AI Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Resumo
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateSummary}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? 'Gerando...' : data.aiSummary ? 'Regenerar' : 'Gerar Resumo'}
          </Button>
        </div>
        {data.aiSummary && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">{data.aiSummary}</p>
          </div>
        )}
      </div>

      <Separator />

      {/* Summary */}
      <div>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
          Resumo do Relatório
        </h3>

        <div className="space-y-4 text-sm">
          {/* Basic Info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {format(data.date, "dd 'de' MMMM, yyyy", { locale: ptBR })} • {shiftLabels[data.shift]}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{data.startTime} - {data.endTime}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{project?.name || 'Não selecionada'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{team?.name || 'Não selecionada'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
              <MapPin className="h-4 w-4" />
              <span>{data.activityLocation || 'Não informado'}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-foreground">{data.activities.length}</p>
              <p className="text-xs text-muted-foreground">Atividades</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-foreground">
                {data.activities.filter(a => a.completed).length}
              </p>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${
              data.deviations.length > 0 ? 'bg-warning/10' : 'bg-success/10'
            }`}>
              <p className={`text-2xl font-bold ${
                data.deviations.length > 0 ? 'text-warning' : 'text-success'
              }`}>
                {data.deviations.length}
              </p>
              <p className="text-xs text-muted-foreground">Desvios</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">
                {data.attendance.filter(a => a.present).length}
              </p>
              <p className="text-xs text-muted-foreground">Presentes</p>
            </div>
          </div>

          {/* Deviations Alert */}
          {data.deviations.filter(d => d.impact === 'high').length > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Atenção: Desvios de Alto Impacto</p>
                <p className="text-sm text-muted-foreground">
                  {data.deviations.filter(d => d.impact === 'high').length} desvio(s) de alto impacto registrado(s)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Preview da IA */}
      <AISummaryPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        generatedText={generatedText}
        onAccept={handleAcceptSummary}
        onRegenerate={handleRegenerate}
        isRegenerating={isGenerating}
      />
    </div>
  );
}
