import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sun, Moon, Plus, Copy, Sparkles } from 'lucide-react';
import { TAB_COLORS } from '@/components/reports/ReportTabs';

export interface SiblingReport {
  id: string;
  shift: string;
  rdo_number: number | null;
  created_at: string;
}

interface ReportDetailTabsProps {
  siblings: SiblingReport[];
  activeReportId: string;
  projectId: string;
  reportDate: string;
  onDuplicate?: () => void;
}

export function ReportDetailTabs({ siblings, activeReportId, projectId, reportDate, onDuplicate }: ReportDetailTabsProps) {
  const navigate = useNavigate();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleNewBlank = () => {
    setPopoverOpen(false);
    navigate(`/reports/create/${projectId}`, {
      state: { date: reportDate },
    });
  };

  const handleDuplicate = () => {
    setPopoverOpen(false);
    onDuplicate?.();
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 overflow-x-auto min-w-0">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-8 w-8 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Nova aba</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-56 p-1" align="start" sideOffset={8}>
            <button
              onClick={handleDuplicate}
              className="group flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-sm hover:bg-primary hover:text-primary-foreground transition-colors text-left"
            >
              <Copy className="h-4 w-4 text-primary shrink-0 group-hover:text-primary-foreground" />
              <div>
                <p className="font-medium">Mesma atividade</p>
                <p className="text-xs text-muted-foreground group-hover:text-primary-foreground/80">Duplicar dados do RDO atual</p>
              </div>
            </button>
            <button
              onClick={handleNewBlank}
              className="group flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-sm hover:bg-primary hover:text-primary-foreground transition-colors text-left"
            >
              <Sparkles className="h-4 w-4 text-primary shrink-0 group-hover:text-primary-foreground" />
              <div>
                <p className="font-medium">Nova atividade</p>
                <p className="text-xs text-muted-foreground group-hover:text-primary-foreground/80">Iniciar formulário em branco</p>
              </div>
            </button>
          </PopoverContent>
        </Popover>

        {siblings.map((sibling, index) => {
          const isActive = sibling.id === activeReportId;
          const tabNumber = index + 1;
          const isMorning = sibling.shift === 'morning';
          const ShiftIcon = isMorning ? Sun : Moon;
          const shiftColor = isMorning ? 'text-amber-500' : 'text-indigo-500';
          const shiftLabel = isMorning ? 'Diurno' : 'Noturno';
          const colors = TAB_COLORS[index % TAB_COLORS.length];

          return (
            <Tooltip key={sibling.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    if (!isActive) navigate(`/reports/${sibling.id}`);
                  }}
                  className={cn(
                    "group flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all min-w-0 shrink-0",
                    isActive
                      ? `bg-background shadow-sm border-b-2 ${colors.border} text-foreground`
                      : "hover:bg-background/50 text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 leading-none text-white",
                      isActive ? colors.badge : "bg-muted-foreground/20 text-muted-foreground"
                    )}
                  >
                    {tabNumber}
                  </span>
                  <ShiftIcon className={cn("h-3.5 w-3.5 shrink-0", shiftColor)} />
                  <span className="truncate max-w-[80px]">{shiftLabel}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-semibold">RDO {tabNumber} — {shiftLabel}</p>
                {sibling.rdo_number && (
                  <p className="text-muted-foreground">Nº {sibling.rdo_number}</p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
