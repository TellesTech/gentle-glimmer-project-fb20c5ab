import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileText, Check, Clock, Send, PenLine, Pencil, Archive, 
  RotateCcw, ArrowRightLeft, CheckCircle, ShieldCheck, Bot 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface HistoryEntry {
  id: string;
  action: string;
  action_at: string;
  details?: unknown;
  old_values?: unknown;
  new_values?: unknown;
  actor?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  } | null;
}

interface ApprovalTimelineProps {
  history?: HistoryEntry[];
  isLoading?: boolean;
}

interface TimelineStep {
  icon: LucideIcon;
  label: string;
  date: Date | null;
  by?: string;
  avatarUrl?: string | null;
  completed: boolean;
  details?: string;
  iconColor?: string;
}

const ACTION_CONFIG: Record<string, { icon: LucideIcon; label: string; iconColor: string }> = {
  created: { icon: FileText, label: 'Criado', iconColor: 'bg-success/10 text-success' },
  updated: { icon: Pencil, label: 'Editado', iconColor: 'bg-primary/10 text-primary' },
  status_changed: { icon: ArrowRightLeft, label: 'Status alterado', iconColor: 'bg-accent/20 text-accent-foreground' },
  sent: { icon: Send, label: 'Enviado para Assinatura', iconColor: 'bg-warning/10 text-warning' },
  signed: { icon: PenLine, label: 'Assinado', iconColor: 'bg-success/10 text-success' },
  finalized: { icon: CheckCircle, label: 'Finalizado', iconColor: 'bg-success/10 text-success' },
  approved: { icon: ShieldCheck, label: 'Aprovado', iconColor: 'bg-success/10 text-success' },
  archived: { icon: Archive, label: 'Arquivado', iconColor: 'bg-muted text-muted-foreground' },
  unarchived: { icon: RotateCcw, label: 'Restaurado', iconColor: 'bg-primary/10 text-primary' },
  whatsapp_created: { icon: Bot, label: 'Criado via WhatsApp', iconColor: 'bg-emerald-500/10 text-emerald-600' },
  whatsapp_updated: { icon: Bot, label: 'Atualizado via WhatsApp', iconColor: 'bg-emerald-500/10 text-emerald-600' },
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  completed: 'Concluído',
  finalized: 'Finalizado',
  sent: 'Enviado',
  signed: 'Assinado',
};

const FIELD_LABELS: Record<string, string> = {
  comments: 'Observações',
  location: 'Local',
  shift: 'Turno',
  weather: 'Clima',
  date: 'Data',
};

function getChangedFieldsDescription(oldValues?: unknown, newValues?: unknown): string {
  if (!oldValues || !newValues || typeof newValues !== 'object') return '';
  
  const newVals = newValues as Record<string, unknown>;
  const changedFields = Object.keys(newVals)
    .map(key => FIELD_LABELS[key] || key)
    .filter(Boolean);
  
  if (changedFields.length === 0) return '';
  return `Alterou: ${changedFields.join(', ')}`;
}

function getStatusChangeDescription(details?: unknown): string {
  if (!details || typeof details !== 'object') return '';
  
  const d = details as Record<string, unknown>;
  const oldStatus = d.old_status as string;
  const newStatus = d.new_status as string;
  
  if (!oldStatus || !newStatus) return '';
  
  const oldLabel = STATUS_LABELS[oldStatus] || oldStatus;
  const newLabel = STATUS_LABELS[newStatus] || newStatus;
  
  return `${oldLabel} → ${newLabel}`;
}

export function ApprovalTimeline({ history = [], isLoading }: ApprovalTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground">
        <Clock className="w-5 h-5" />
        <p className="text-sm">Nenhum histórico disponível</p>
      </div>
    );
  }

  // Sort history by action_at ascending (oldest first)
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.action_at).getTime() - new Date(b.action_at).getTime()
  );

  const steps: TimelineStep[] = sortedHistory.map(entry => {
    const config = ACTION_CONFIG[entry.action] || { 
      icon: Clock, 
      label: entry.action, 
      iconColor: 'bg-muted text-muted-foreground' 
    };

    const isWhatsApp = entry.action === 'whatsapp_created' || entry.action === 'whatsapp_updated';

    let details = '';
    if (entry.action === 'updated') {
      details = getChangedFieldsDescription(entry.old_values, entry.new_values);
    } else if (entry.action === 'status_changed') {
      details = getStatusChangeDescription(entry.details);
    } else if (isWhatsApp && entry.details && typeof entry.details === 'object') {
      const d = entry.details as Record<string, unknown>;
      const sender = d.sender_name as string;
      const isValidSender = sender && sender.trim().length >= 2 && /[a-zA-ZÀ-ú]/.test(sender);
      if (isValidSender) details = `Enviado por ${sender.trim()} via WhatsApp`;
    }

    // For WhatsApp actions, prefer sender_name from details over generic fallback
    const rawWhatsAppSender = isWhatsApp && entry.details && typeof entry.details === 'object'
      ? (entry.details as Record<string, unknown>).sender_name as string | undefined
      : undefined;
    const whatsAppSender = rawWhatsAppSender && rawWhatsAppSender.trim().length >= 2 ? rawWhatsAppSender.trim() : undefined;
    const actorName = entry.actor?.name || whatsAppSender || (isWhatsApp ? 'Assistente IA RDO' : undefined);
    const actorAvatar = entry.actor?.avatar_url || null;

    return {
      icon: config.icon,
      label: config.label,
      date: new Date(entry.action_at),
      by: actorName,
      avatarUrl: actorAvatar,
      completed: true,
      details,
      iconColor: config.iconColor,
    };
  });

  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === steps.length - 1;
        
        return (
          <div key={index} className="flex gap-3">
            {/* Icon and Line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  step.iconColor || (step.completed
                    ? 'bg-success/10 text-success'
                    : 'bg-muted text-muted-foreground')
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 h-8 my-1',
                    step.completed ? 'bg-border' : 'bg-muted'
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                {step.by && (
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={step.avatarUrl || undefined} />
                    <AvatarFallback className={cn(
                      "text-[10px]",
                      step.by === 'Assistente IA RDO' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-muted'
                    )}>
                      {step.by === 'Assistente IA RDO' 
                        ? <Bot className="w-3 h-3" /> 
                        : step.by.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                      }
                    </AvatarFallback>
                  </Avatar>
                )}
                <p className={cn(
                  'font-medium text-sm',
                  step.completed ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {step.label}
                  {step.by && (
                    <span className="font-normal text-muted-foreground"> por {step.by}</span>
                  )}
                </p>
              </div>
              {step.date && (
                <p className={cn("text-xs text-muted-foreground", step.by && "ml-7")}>
                  {format(step.date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
              {step.details && (
                <p className={cn("text-xs text-primary/80 mt-0.5", step.by && "ml-7")}>
                  {step.details}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
