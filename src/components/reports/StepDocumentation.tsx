import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileText, Clock } from 'lucide-react';
import type { ReportFormData } from '@/pages/ReportForm';

interface StepDocumentationProps {
  data: ReportFormData;
  onChange: (data: Partial<ReportFormData>) => void;
}

export function StepDocumentation({ data, onChange }: StepDocumentationProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <FileText className="h-5 w-5" />
        <p className="text-sm">Horários de liberação e documentação</p>
      </div>

      <div className="space-y-4">
        {/* Arrival Time at Liberator */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Horário de Chegada no Liberador
          </Label>
          <Input
            type="time"
            value={data.arrivalTimeAtLiberator}
            onChange={(e) => onChange({ arrivalTimeAtLiberator: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Horário em que a equipe chegou ao ponto do liberador
          </p>
        </div>

        {/* Document Release Time */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-success" />
            Horário de Liberação da Documentação
          </Label>
          <Input
            type="time"
            value={data.documentReleaseTime}
            onChange={(e) => onChange({ documentReleaseTime: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Horário em que a documentação foi liberada para início das atividades
          </p>
        </div>

        {/* Block Revalidation Time */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            Horário de Revalidação do Bloqueio
          </Label>
          <Input
            type="time"
            value={data.blockRevalidationTime}
            onChange={(e) => onChange({ blockRevalidationTime: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Horário programado para revalidação do bloqueio de segurança
          </p>
        </div>
      </div>
    </div>
  );
}
