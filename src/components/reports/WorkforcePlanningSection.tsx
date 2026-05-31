import { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, Copy } from 'lucide-react';
import { format, eachDayOfInterval, parseISO, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface DailyWorkforce {
  date: string;
  planned_count: number;
}

interface WorkforcePlanningSectionProps {
  mode: 'default' | 'daily';
  defaultCount: number;
  dailyWorkforce: DailyWorkforce[];
  startDate: string | null;
  endDate: string | null;
  onModeChange: (mode: 'default' | 'daily') => void;
  onDefaultCountChange: (count: number) => void;
  onDailyWorkforceChange: (workforce: DailyWorkforce[]) => void;
  disabled?: boolean;
}

export function WorkforcePlanningSection({
  mode,
  defaultCount,
  dailyWorkforce,
  startDate,
  endDate,
  onModeChange,
  onDefaultCountChange,
  onDailyWorkforceChange,
  disabled = false,
}: WorkforcePlanningSectionProps) {
  const [applyAllValue, setApplyAllValue] = useState<number>(defaultCount || 0);

  // Generate list of dates between start and end
  const dateRange = useMemo(() => {
    if (!startDate || !endDate) return [];
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      if (start > end) return [];
      return eachDayOfInterval({ start, end });
    } catch {
      return [];
    }
  }, [startDate, endDate]);

  // Initialize daily workforce when switching to daily mode
  useEffect(() => {
    if (mode === 'daily' && dateRange.length > 0 && dailyWorkforce.length === 0) {
      const initialDaily = dateRange.map(date => ({
        date: format(date, 'yyyy-MM-dd'),
        planned_count: defaultCount || 0,
      }));
      onDailyWorkforceChange(initialDaily);
    }
  }, [mode, dateRange, dailyWorkforce.length, defaultCount, onDailyWorkforceChange]);

  const handleApplyAll = () => {
    if (dateRange.length === 0) return;
    const newDaily = dateRange.map(date => ({
      date: format(date, 'yyyy-MM-dd'),
      planned_count: applyAllValue,
    }));
    onDailyWorkforceChange(newDaily);
  };

  const handleDayChange = (dateStr: string, value: number) => {
    const existing = dailyWorkforce.find(d => d.date === dateStr);
    if (existing) {
      onDailyWorkforceChange(
        dailyWorkforce.map(d => d.date === dateStr ? { ...d, planned_count: value } : d)
      );
    } else {
      onDailyWorkforceChange([...dailyWorkforce, { date: dateStr, planned_count: value }]);
    }
  };

  const getCountForDate = (dateStr: string): number => {
    const entry = dailyWorkforce.find(d => d.date === dateStr);
    return entry?.planned_count ?? defaultCount ?? 0;
  };

  const hasDateRange = startDate && endDate && dateRange.length > 0;

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        Quantidade de Efetivo
      </Label>

      <RadioGroup
        value={mode}
        onValueChange={(value) => onModeChange(value as 'default' | 'daily')}
        className="flex gap-4"
        disabled={disabled}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="default" id="workforce-default" />
          <Label htmlFor="workforce-default" className="font-normal cursor-pointer">
            Igual para todos os dias
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="daily" id="workforce-daily" disabled={!hasDateRange} />
          <Label 
            htmlFor="workforce-daily" 
            className={`font-normal cursor-pointer ${!hasDateRange ? 'text-muted-foreground' : ''}`}
          >
            Por dia
          </Label>
        </div>
      </RadioGroup>

      {mode === 'default' && (
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
          <Label htmlFor="default-workforce" className="whitespace-nowrap">
            Quantidade padrão:
          </Label>
          <Input
            id="default-workforce"
            type="number"
            min={0}
            value={defaultCount || ''}
            onChange={(e) => onDefaultCountChange(parseInt(e.target.value) || 0)}
            className="w-24"
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground">pessoas</span>
        </div>
      )}

      {mode === 'daily' && (
        <div className="space-y-3">
          {!hasDateRange ? (
            <div className="p-4 rounded-lg border border-dashed text-center text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Defina as datas de início e fim da atividade para programar o efetivo por dia.</p>
            </div>
          ) : (
            <>
              {/* Apply to all */}
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                <Label className="whitespace-nowrap text-sm">Aplicar em todos:</Label>
                <Input
                  type="number"
                  min={0}
                  value={applyAllValue || ''}
                  onChange={(e) => setApplyAllValue(parseInt(e.target.value) || 0)}
                  className="w-20 h-8"
                  disabled={disabled}
                />
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={handleApplyAll}
                  disabled={disabled}
                  className="h-8"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Aplicar
                </Button>
              </div>

              {/* Daily list */}
              <ScrollArea className="h-[200px] rounded-lg border">
                <div className="p-2 space-y-1">
                  {dateRange.map(date => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const isWeekendDay = isWeekend(date);
                    const count = getCountForDate(dateStr);

                    return (
                      <div 
                        key={dateStr} 
                        className={`flex items-center justify-between p-2 rounded-md ${
                          isWeekendDay ? 'bg-muted/50' : 'hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-24">
                            {format(date, 'dd/MM/yyyy')}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {format(date, 'EEE', { locale: ptBR })}
                          </Badge>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          value={count || ''}
                          onChange={(e) => handleDayChange(dateStr, parseInt(e.target.value) || 0)}
                          className="w-20 h-8 text-center"
                          disabled={disabled}
                        />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Summary */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Total de dias: {dateRange.length}</span>
                <span>•</span>
                <span>
                  Média: {dailyWorkforce.length > 0 
                    ? Math.round(dailyWorkforce.reduce((sum, d) => sum + d.planned_count, 0) / dailyWorkforce.length) 
                    : 0} pessoas
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
