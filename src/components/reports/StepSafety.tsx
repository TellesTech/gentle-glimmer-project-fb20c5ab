import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Ambulance, Users, Radio } from 'lucide-react';
import type { ReportFormData } from '@/pages/ReportForm';

interface StepSafetyProps {
  data: ReportFormData;
  onChange: (data: Partial<ReportFormData>) => void;
}

export function StepSafety({ data, onChange }: StepSafetyProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <Ambulance className="h-5 w-5" />
        <p className="text-sm">Informações de segurança e comunicação da equipe</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Ambulance Point */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Ambulance className="h-4 w-4 text-destructive" />
            Ponto de Ambulância
          </Label>
          <Input
            value={data.ambulancePoint}
            onChange={(e) => onChange({ ambulancePoint: e.target.value })}
            placeholder="Ex: Portaria Principal"
          />
        </div>

        {/* Meeting Point */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Ponto de Encontro
          </Label>
          <Input
            value={data.meetingPoint}
            onChange={(e) => onChange({ meetingPoint: e.target.value })}
            placeholder="Ex: Área de Vivência"
          />
        </div>

        {/* Radio Frequency Wees */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-warning" />
            Faixa Rádio Wees
          </Label>
          <Input
            value={data.radioFrequencyWees}
            onChange={(e) => onChange({ radioFrequencyWees: e.target.value })}
            placeholder="Ex: 450.125"
          />
        </div>

        {/* Radio Frequency Operation */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-success" />
            Faixa Rádio Operação
          </Label>
          <Input
            value={data.radioFrequencyOperation}
            onChange={(e) => onChange({ radioFrequencyOperation: e.target.value })}
            placeholder="Ex: 450.250"
          />
        </div>
      </div>
    </div>
  );
}
