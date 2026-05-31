import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Plus, X, Sun, Moon, Copy, Sparkles } from 'lucide-react';
import { ReportTab } from '@/hooks/useReportTabs';
import { format } from 'date-fns';

export const TAB_COLORS = [
  { bg: 'bg-card', border: 'border-border', badge: 'bg-primary' },
  { bg: 'bg-card', border: 'border-border', badge: 'bg-primary' },
  { bg: 'bg-card', border: 'border-border', badge: 'bg-primary' },
  { bg: 'bg-card', border: 'border-border', badge: 'bg-primary' },
  { bg: 'bg-card', border: 'border-border', badge: 'bg-primary' },
];

interface ReportTabsProps {
  tabs: ReportTab[];
  activeTabId: string;
  onAddTab: () => void;
  onAddTabFromExisting?: () => void;
  onRemoveTab: (tabId: string) => void;
  onSelectTab: (tabId: string) => void;
  canAddTab: boolean;
}

function extractShiftLabel(tab: ReportTab): string {
  const match = tab.label.match(/- (.+)$/);
  if (match) return match[1];
  return tab.formData.shift === 'morning' ? 'Diurno' : 'Noturno';
}

export function ReportTabs({
  tabs,
  activeTabId,
  onAddTab,
  onAddTabFromExisting,
  onRemoveTab,
  onSelectTab,
  canAddTab,
}: ReportTabsProps) {
  const [tabToClose, setTabToClose] = useState<ReportTab | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleCloseClick = (e: React.MouseEvent, tab: ReportTab) => {
    e.stopPropagation();
    
    if (tab.isDirty) {
      setTabToClose(tab);
    } else {
      onRemoveTab(tab.id);
    }
  };

  const confirmClose = () => {
    if (tabToClose) {
      onRemoveTab(tabToClose.id);
      setTabToClose(null);
    }
  };

  const handleNewBlank = () => {
    setPopoverOpen(false);
    onAddTab();
  };

  const handleDuplicate = () => {
    setPopoverOpen(false);
    onAddTabFromExisting?.();
  };

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 mb-4 overflow-x-auto min-w-0">
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canAddTab}
                    className="shrink-0 h-8 w-8 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>
                {canAddTab ? 'Nova aba (máx. 5)' : 'Limite de 5 abas atingido'}
              </TooltipContent>
            </Tooltip>
            <PopoverContent className="w-56 p-1" align="start" sideOffset={8}>
              <button
                onClick={handleDuplicate}
                className="group flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-sm hover:bg-primary hover:text-primary-foreground transition-colors text-left"
              >
                <Copy className="h-4 w-4 text-primary shrink-0 group-hover:text-primary-foreground" />
                <div>
                  <p className="font-medium">Mesma atividade</p>
                  <p className="text-xs text-muted-foreground group-hover:text-primary-foreground/80">Duplicar dados da aba atual</p>
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

          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const tabNumber = index + 1;
            const shiftLabel = extractShiftLabel(tab);
            const ShiftIcon = tab.formData.shift === 'morning' ? Sun : Moon;
            const shiftColor = tab.formData.shift === 'morning' ? 'text-amber-500' : 'text-indigo-500';
            const formattedDate = format(new Date(tab.formData.date + 'T12:00:00'), 'dd/MM/yyyy');
            const shiftFullLabel = tab.formData.shift === 'morning' ? 'Diurno' : 'Noturno';
            const statusLabel = tab.isDirty ? '• Não salvo' : '✓ Salvo';

            return (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSelectTab(tab.id)}
                    className={cn(
                      "group flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all min-w-0 shrink-0",
                      isActive
                        ? `bg-background shadow-sm border-b-2 ${TAB_COLORS[index % TAB_COLORS.length].border} text-foreground`
                        : "hover:bg-background/50 text-muted-foreground"
                    )}
                  >
                    {/* Numeric badge */}
                    <span
                      className={cn(
                        "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 leading-none text-white",
                        isActive
                          ? TAB_COLORS[index % TAB_COLORS.length].badge
                          : "bg-muted-foreground/20 text-muted-foreground"
                      )}
                    >
                      {tabNumber}
                    </span>

                    <ShiftIcon className={cn("h-3.5 w-3.5 shrink-0", shiftColor)} />
                    <span className="truncate max-w-[80px]">{shiftLabel}</span>
                    
                    {/* Dirty indicator */}
                    {tab.isDirty && (
                      <span 
                        className="w-2 h-2 rounded-full bg-orange-400 shrink-0 animate-pulse" 
                        title="Alterações não salvas"
                      />
                    )}
                    
                    {/* Close button */}
                    {tabs.length > 1 && (
                      <button
                        onClick={(e) => handleCloseClick(e, tab)}
                        className={cn(
                          "ml-0.5 p-0.5 rounded hover:bg-destructive/20 transition-opacity shrink-0",
                          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                        title="Fechar aba"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-semibold">RDO {tabNumber} — {shiftFullLabel}</p>
                  <p className="text-muted-foreground">{formattedDate} {statusLabel}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground -mt-2 mb-3 ml-1">
          Cada aba representa um RDO diferente para a mesma data. Use o botão <strong>+</strong> para adicionar turnos ou atividades.
        </p>
      </TooltipProvider>

      <ConfirmDialog
        open={!!tabToClose}
        onOpenChange={(open) => !open && setTabToClose(null)}
        title="Descartar alterações?"
        description="Você tem alterações não salvas nesta aba. Deseja descartar as alterações e fechar?"
        confirmText="Descartar"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={confirmClose}
      />
    </>
  );
}
