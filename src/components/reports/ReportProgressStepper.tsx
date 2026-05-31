import { FileText, Clock, Send, PenLine, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReportStatus = 'draft' | 'completed' | 'sent' | 'signed';

interface ReportProgressStepperProps {
  status: ReportStatus | string;
  hasDocuments?: boolean;
  compact?: boolean;
  className?: string;
}

const steps = [
  { key: 'draft', label: 'Rascunho', icon: FileText },
  { key: 'completed', label: 'Aguardando Envio', icon: Clock },
  { key: 'sent', label: 'Enviado', icon: Send },
  { key: 'signed', label: 'Assinado', icon: PenLine },
];

const getStepIndex = (status: string): number => {
  const index = steps.findIndex(s => s.key === status);
  return index >= 0 ? index : 0;
};

export function ReportProgressStepper({ 
  status, 
  hasDocuments = false, 
  compact = false,
  className 
}: ReportProgressStepperProps) {
  const currentIndex = getStepIndex(status);

  return (
    <div className={cn("flex items-center w-full", className)}>
      {steps.map((step, index) => {
        const isLastStepCompleted = step.key === 'signed' && status === 'signed';
        const isCompleted = index < currentIndex || isLastStepCompleted;
        const isCurrent = index === currentIndex && !isLastStepCompleted;
        const isPending = index > currentIndex;
        
        const StepIcon = isCompleted ? Check : step.icon;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border-2 transition-all",
                  compact ? "w-6 h-6" : "w-8 h-8",
                  isCompleted && "bg-green-500 border-green-500 text-white",
                  isCurrent && "bg-primary border-primary text-primary-foreground animate-pulse",
                  isPending && "bg-background border-muted-foreground/30 text-muted-foreground/50"
                )}
              >
                <StepIcon className={cn(compact ? "w-3 h-3" : "w-4 h-4")} />
              </div>
              
              {/* Label - Only in full mode */}
              {!compact && (
                <span
                  className={cn(
                    "mt-2 text-xs text-center font-medium max-w-[80px] leading-tight",
                    isCompleted && "text-green-600",
                    isCurrent && "text-primary",
                    isPending && "text-muted-foreground/50"
                  )}
                >
                  {step.label}
                </span>
              )}
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-1",
                  compact ? "mx-0.5" : "mx-2",
                  index < currentIndex ? "bg-green-500" : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
