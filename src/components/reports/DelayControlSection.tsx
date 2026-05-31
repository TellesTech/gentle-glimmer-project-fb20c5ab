import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock } from 'lucide-react';
import { useDelayReasons, DelayCategory } from '@/hooks/useDelayReasons';
import { AdditionalDelaysSection, AdditionalDelay } from './AdditionalDelaysSection';

interface DelayBlockProps {
  category: DelayCategory;
  title: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  hours: string;
  reason: string;
  details: string;
  onHoursChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
}

function DelayBlock({
  category,
  title,
  colorClass,
  bgClass,
  borderClass,
  hours,
  reason,
  details,
  onHoursChange,
  onReasonChange,
  onDetailsChange,
}: DelayBlockProps) {
  const { data: reasons = [] } = useDelayReasons(category);

  return (
    <div className={`p-4 rounded-lg ${bgClass} border ${borderClass} space-y-3`}>
      <div className="flex items-center gap-2">
        <div className={`h-3 w-3 rounded-full ${colorClass.replace('text-', 'bg-')}`} />
        <span className={`font-medium ${colorClass}`}>{title}</span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Horas</Label>
          <Input
            type="time"
            value={hours}
            onChange={(e) => onHoursChange(e.target.value)}
            className="mt-1"
            placeholder="00:00"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Motivo</Label>
          <Select value={reason} onValueChange={onReasonChange}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione o motivo..." />
            </SelectTrigger>
            <SelectContent>
              {reasons.map((r) => (
                <SelectItem key={r.id} value={r.label}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {(hours || reason) && (
        <div>
          <Label className="text-xs text-muted-foreground">Detalhes adicionais (opcional)</Label>
          <Textarea
            placeholder="Informações complementares..."
            value={details}
            onChange={(e) => onDetailsChange(e.target.value)}
            rows={2}
            className="mt-1"
          />
        </div>
      )}
    </div>
  );
}

interface DelayControlSectionProps {
  formData: {
    operationalDeviationHours?: string;
    operationalDeviationReason?: string;
    operationalDeviationDetails?: string;
    climaticDeviationHours?: string;
    climaticDeviationReason?: string;
    climaticDeviationDetails?: string;
    amtDeviationHours?: string;
    amtDeviationReason?: string;
    amtDeviationDetails?: string;
    additionalDelays?: AdditionalDelay[];
  };
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

export function DelayControlSection({ formData, setFormData }: DelayControlSectionProps) {
  return (
    <Card className="border-orange-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-500" />
          Controle de Atrasos (Horas)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Registre o tempo perdido por categoria de atraso no dia
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Atraso Operacional */}
        <DelayBlock
          category="operational"
          title="Atraso Operacional"
          colorClass="text-orange-600"
          bgClass="bg-orange-500/10"
          borderClass="border-orange-500/20"
          hours={formData.operationalDeviationHours || ''}
          reason={formData.operationalDeviationReason || ''}
          details={formData.operationalDeviationDetails || ''}
          onHoursChange={(value) => setFormData((prev: any) => ({ ...prev, operationalDeviationHours: value }))}
          onReasonChange={(value) => setFormData((prev: any) => ({ ...prev, operationalDeviationReason: value }))}
          onDetailsChange={(value) => setFormData((prev: any) => ({ ...prev, operationalDeviationDetails: value }))}
        />

        {/* Atraso Climático */}
        <DelayBlock
          category="climatic"
          title="Atraso Climático"
          colorClass="text-blue-600"
          bgClass="bg-blue-500/10"
          borderClass="border-blue-500/20"
          hours={formData.climaticDeviationHours || ''}
          reason={formData.climaticDeviationReason || ''}
          details={formData.climaticDeviationDetails || ''}
          onHoursChange={(value) => setFormData((prev: any) => ({ ...prev, climaticDeviationHours: value }))}
          onReasonChange={(value) => setFormData((prev: any) => ({ ...prev, climaticDeviationReason: value }))}
          onDetailsChange={(value) => setFormData((prev: any) => ({ ...prev, climaticDeviationDetails: value }))}
        />

        {/* Outros Desvios (AMT) */}
        <DelayBlock
          category="amt"
          title="Outros Desvios (AMT)"
          colorClass="text-amber-600"
          bgClass="bg-amber-500/10"
          borderClass="border-amber-500/20"
          hours={formData.amtDeviationHours || ''}
          reason={formData.amtDeviationReason || ''}
          details={formData.amtDeviationDetails || ''}
          onHoursChange={(value) => setFormData((prev: any) => ({ ...prev, amtDeviationHours: value }))}
          onReasonChange={(value) => setFormData((prev: any) => ({ ...prev, amtDeviationReason: value }))}
          onDetailsChange={(value) => setFormData((prev: any) => ({ ...prev, amtDeviationDetails: value }))}
        />

        {/* Atrasos Adicionais (Livres) */}
        <AdditionalDelaysSection 
          delays={formData.additionalDelays || []}
          onChange={(delays) => setFormData((prev: any) => ({ ...prev, additionalDelays: delays }))}
        />
      </CardContent>
    </Card>
  );
}
