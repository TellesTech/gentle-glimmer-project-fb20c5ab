import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, Building2, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useReportSignaturesRealtime, type SignatureEntry } from '@/hooks/useReportSignaturesRealtime';
import { cn } from '@/lib/utils';

interface Props {
  reportId: string;
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

function Row({ entry }: { entry: SignatureEntry }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
        entry.signed ? 'bg-[hsl(var(--success))]/5 border-[hsl(var(--success))]/20' : 'bg-muted/30 border-border',
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        {entry.avatarUrl ? <AvatarImage src={entry.avatarUrl} alt={entry.name} /> : null}
        <AvatarFallback className={cn(
          'text-xs font-semibold',
          entry.signed ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-primary/10 text-primary',
        )}>
          {initials(entry.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{entry.name}</p>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          <span className="truncate">{entry.role || '—'}</span>
          {entry.companyName ? (
            <>
              <span className="opacity-50">·</span>
              <Building2 className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate font-medium">{entry.companyName}</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="text-right shrink-0">
        {entry.signed ? (
          <>
            <Badge className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] gap-1 mb-1">
              <CheckCircle2 className="h-3 w-3" /> Assinado
            </Badge>
            {entry.signedAt && (
              <p className="text-[10px] text-muted-foreground">
                {format(parseISO(entry.signedAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </>
        ) : (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> Pendente
          </Badge>
        )}
      </div>
    </div>
  );
}

export function SignatureTimeline({ reportId }: Props) {
  const { data, isLoading, summary } = useReportSignaturesRealtime(reportId);

  const entries = data?.entries || [];
  const wees = entries.filter((e) => e.side === 'wees');
  const client = entries.filter((e) => e.side === 'client');

  // Use real company names from the signers (fallback to generic labels)
  const weesCompanyName = wees.find((e) => e.companyName)?.companyName || 'Equipe WEES';
  const clientCompanyName = client.find((e) => e.companyName)?.companyName || 'Equipe Cliente';

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex items-center gap-3 text-sm">
        <Badge variant="secondary" className="gap-1">
          {summary.signed}/{summary.total} assinadas
        </Badge>
        {summary.pending > 0 && (
          <span className="text-muted-foreground text-xs">
            {summary.pending} aguardando
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))] animate-pulse" />
          Atualizando em tempo real
        </span>
      </div>

      {/* WEES */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold truncate">{weesCompanyName}</h3>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {wees.filter((e) => e.signed).length}/{wees.length || 0}
          </Badge>
        </div>
        {wees.length > 0 ? (
          <div className="space-y-2">
            {wees.map((e) => <Row key={e.key} entry={e} />)}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic px-1">Nenhuma assinatura WEES registrada ainda.</p>
        )}
      </div>

      {/* Client */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold truncate">{clientCompanyName}</h3>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {client.filter((e) => e.signed).length}/{client.length || 0}
          </Badge>
        </div>
        {client.length > 0 ? (
          <div className="space-y-2">
            {client.map((e) => <Row key={e.key} entry={e} />)}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic px-1">Nenhum aprovador do cliente designado.</p>
        )}
      </div>
    </div>
  );
}
