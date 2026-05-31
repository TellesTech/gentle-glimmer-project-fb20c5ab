import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Smartphone, Monitor, FileText } from 'lucide-react';

export interface AdditionalDelay {
  _id?: string;
  _source?: 'manual' | 'rdo';
  activity_name: string;
  reason: string;
  description: string;
  hours: string;
}

interface AdditionalDelaysSectionProps {
  delays: AdditionalDelay[];
  onChange: (delays: AdditionalDelay[]) => void;
}

export function AdditionalDelaysSection({ delays, onChange }: AdditionalDelaysSectionProps) {
  const addDelay = () => {
    onChange([...delays, { activity_name: '', reason: '', description: '', hours: '00:00' }]);
  };

  const removeDelay = (index: number) => {
    onChange(delays.filter((_, i) => i !== index));
  };

  const updateDelay = (index: number, field: keyof AdditionalDelay, value: string) => {
    const newDelays = [...delays];
    newDelays[index] = { ...newDelays[index], [field]: value };
    onChange(newDelays);
  };

  return (
    <div className="space-y-4 pt-4 border-t border-orange-500/20">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm font-semibold">Atrasos Adicionais</Label>
          <p className="text-xs text-muted-foreground">Registre outros atrasos específicos que ocorreram no dia</p>
        </div>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={addDelay}
          className="h-8 gap-1 border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>

      {delays.length > 0 ? (
        <div className="space-y-3">
          {delays.map((delay, index) => (
            <div key={index} className="p-3 rounded-lg bg-muted/30 border border-border relative group">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeDelay(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>

              {delay._source && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-background/50 border-muted-foreground/20 text-muted-foreground font-normal gap-1">
                    {delay._source === 'rdo' ? (
                      <>
                        <Smartphone className="h-2.5 w-2.5" />
                        WhatsApp
                      </>
                    ) : delay.reason?.startsWith('[RDO]') ? (
                      <>
                        <FileText className="h-2.5 w-2.5" />
                        RDO
                      </>
                    ) : (
                      <>
                        <Monitor className="h-2.5 w-2.5" />
                        Sistema
                      </>
                    )}
                  </Badge>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 mt-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground">Atividade / Local</Label>
                  <Input 
                    placeholder="Ex: Área de montagem" 
                    value={delay.activity_name}
                    onChange={(e) => updateDelay(index, 'activity_name', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground">Motivo</Label>
                  <Input 
                    placeholder="Ex: Falta de material" 
                    value={delay.reason}
                    onChange={(e) => updateDelay(index, 'reason', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground">Descrição</Label>
                  <Textarea 
                    placeholder="Detalhes adicionais..." 
                    value={delay.description}
                    onChange={(e) => updateDelay(index, 'description', e.target.value)}
                    className="min-h-[40px] h-8 text-xs py-1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground">Tempo (HH:MM)</Label>
                  <Input 
                    type="time"
                    value={delay.hours}
                    onChange={(e) => updateDelay(index, 'hours', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 border border-dashed rounded-lg text-muted-foreground text-xs">
          Nenhum atraso adicional registrado
        </div>
      )}
    </div>
  );
}