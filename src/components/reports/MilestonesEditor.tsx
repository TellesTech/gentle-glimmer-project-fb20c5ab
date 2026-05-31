import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, Trash2, Target, AlertCircle, Flag, Percent, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MilestoneItem {
  id?: string;
  target_date: string;
  target_percentage: number;
  description: string;
  is_start_date: boolean;
}

interface MilestonesEditorProps {
  value: MilestoneItem[];
  onChange: (milestones: MilestoneItem[]) => void;
  disabled?: boolean;
}

export function MilestonesEditor({ value, onChange, disabled }: MilestonesEditorProps) {
  const [openCalendarIndex, setOpenCalendarIndex] = useState<number | null>(null);
  const [openStartCalendar, setOpenStartCalendar] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Separar marco de início dos demais
  const startMilestone = value.find(m => m.is_start_date);
  const progressMilestones = value.filter(m => !m.is_start_date);

  // Validar marcos
  useEffect(() => {
    const errors: string[] = [];
    const sorted = [...progressMilestones].sort((a, b) => 
      parseISO(a.target_date).getTime() - parseISO(b.target_date).getTime()
    );
    
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].target_percentage >= sorted[i + 1].target_percentage) {
        errors.push('Os percentuais devem ser crescentes conforme as datas avançam');
        break;
      }
    }
    
    setValidationErrors(errors);
  }, [value]);

  // Garantir que existe um marco de início
  useEffect(() => {
    if (!startMilestone && value.length === 0) {
      const newStart: MilestoneItem = {
        target_date: format(new Date(), 'yyyy-MM-dd'),
        target_percentage: 0,
        description: 'Início da atividade',
        is_start_date: true,
      };
      onChange([newStart]);
    }
  }, []);

  const handleStartDateChange = (date: Date | undefined) => {
    if (!date) return;
    
    if (startMilestone) {
      const updated = value.map(m => 
        m.is_start_date ? { ...m, target_date: format(date, 'yyyy-MM-dd') } : m
      );
      onChange(updated);
    } else {
      const newStart: MilestoneItem = {
        target_date: format(date, 'yyyy-MM-dd'),
        target_percentage: 0,
        description: 'Início da atividade',
        is_start_date: true,
      };
      onChange([newStart, ...value]);
    }
    setOpenStartCalendar(false);
  };

  const handleAddMilestone = () => {
    const sorted = [...progressMilestones].sort((a, b) => 
      parseISO(a.target_date).getTime() - parseISO(b.target_date).getTime()
    );
    
    let suggestedPercentage = 25;
    let suggestedDate = new Date();
    
    if (sorted.length > 0) {
      const lastMilestone = sorted[sorted.length - 1];
      suggestedPercentage = Math.min(100, Number(lastMilestone.target_percentage) + 25);
      const lastDate = parseISO(lastMilestone.target_date);
      suggestedDate = new Date(lastDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (startMilestone) {
      const startDate = parseISO(startMilestone.target_date);
      suggestedDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    
    const newMilestone: MilestoneItem = {
      target_date: format(suggestedDate, 'yyyy-MM-dd'),
      target_percentage: suggestedPercentage,
      description: '',
      is_start_date: false,
    };
    
    onChange([...value, newMilestone]);
    
    // Auto-scroll para o final após adicionar
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  };

  const handleRemoveMilestone = (milestoneToRemove: MilestoneItem) => {
    const newMilestones = value.filter(m => m !== milestoneToRemove);
    onChange(newMilestones);
  };

  const handleUpdateMilestone = (milestone: MilestoneItem, field: keyof MilestoneItem, fieldValue: any) => {
    const newMilestones = value.map(m => 
      m === milestone ? { ...m, [field]: fieldValue } : m
    );
    onChange(newMilestones);
  };

  const sortedProgressMilestones = [...progressMilestones].sort((a, b) => 
    parseISO(a.target_date).getTime() - parseISO(b.target_date).getTime()
  );

  // Cores alternadas para os cards completos dos marcos
  const cardColors = [
    { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    { bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-200 dark:border-green-800', badge: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    { bg: 'bg-purple-50 dark:bg-purple-950/20', border: 'border-purple-200 dark:border-purple-800', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  ];

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <Label className="font-medium">Linha Base de Avanço (Curva S Planejada)</Label>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Defina a data de início e marcos de progresso para criar a curva planejada.
      </p>

      {validationErrors.length > 0 && (
        <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            {validationErrors.map((error, i) => (
              <p key={i}>{error}</p>
            ))}
          </div>
        </div>
      )}

      {/* Data de Início - Seção Destacada com borda esquerda */}
      <div className="bg-primary/5 border border-primary/20 border-l-4 border-l-primary rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium text-primary">Data de Início da Atividade</Label>
          <Badge className="ml-auto bg-primary/20 text-primary text-xs">0%</Badge>
        </div>
        
        <Popover open={openStartCalendar} onOpenChange={setOpenStartCalendar}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className={cn(
                "w-full justify-start font-normal bg-background",
                !startMilestone?.target_date && "text-muted-foreground"
              )}
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startMilestone?.target_date 
                ? format(parseISO(startMilestone.target_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                : "Selecione a data de início"
              }
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startMilestone ? parseISO(startMilestone.target_date) : undefined}
              onSelect={handleStartDateChange}
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <Separator />

      {/* Marcos de Progresso */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Marcos de Progresso</Label>
          <Badge variant="outline" className="text-xs">
            {progressMilestones.length} marco{progressMilestones.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Lista com scroll nativo */}
        {sortedProgressMilestones.length > 0 && (
          <div 
            ref={listRef}
            className="max-h-[320px] overflow-y-auto pr-1 space-y-3"
          >
            {sortedProgressMilestones.map((milestone, index) => {
              const colors = cardColors[index % cardColors.length];
              
              return (
                <div 
                  key={`${milestone.target_date}-${index}`}
                  className={cn(
                    "rounded-lg p-3 space-y-3 shadow-sm border",
                    colors.bg,
                    colors.border
                  )}
                >
                  {/* Header com número do marco e botão deletar */}
                  <div className="flex items-center justify-between">
                    <Badge className={cn("text-xs font-medium", colors.badge)}>
                      Marco {index + 1}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveMilestone(milestone)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Grid de campos */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Percentual */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        Percentual
                      </Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={milestone.target_percentage}
                          onChange={(e) => handleUpdateMilestone(milestone, 'target_percentage', Number(e.target.value))}
                          className="h-9 bg-white dark:bg-background text-center font-medium"
                          disabled={disabled}
                        />
                        <span className="text-sm font-medium text-muted-foreground">%</span>
                      </div>
                    </div>
                    
                    {/* Data */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        Data Prevista
                      </Label>
                      <Popover 
                        open={openCalendarIndex === index}
                        onOpenChange={(open) => setOpenCalendarIndex(open ? index : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full justify-start font-normal h-9 bg-white dark:bg-background text-xs"
                            disabled={disabled}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {format(parseISO(milestone.target_date), 'dd/MM/yyyy')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={parseISO(milestone.target_date)}
                            onSelect={(date) => {
                              if (date) {
                                handleUpdateMilestone(milestone, 'target_date', format(date, 'yyyy-MM-dd'));
                              }
                              setOpenCalendarIndex(null);
                            }}
                            locale={ptBR}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Descrição (largura total) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Descrição (opcional)
                    </Label>
                    <Input
                      placeholder="Ex: Conclusão da fundação"
                      value={milestone.description}
                      onChange={(e) => handleUpdateMilestone(milestone, 'description', e.target.value)}
                      className="h-9 bg-white dark:bg-background"
                      disabled={disabled}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Botão fora da área de scroll - sempre visível */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddMilestone}
          disabled={disabled}
          className="w-full gap-2"
        >
          <Plus className="h-4 w-4" />
          Adicionar Marco
        </Button>

        {progressMilestones.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Adicione marcos para definir pontos intermediários da curva planejada.
          </p>
        )}
      </div>
    </div>
  );
}
