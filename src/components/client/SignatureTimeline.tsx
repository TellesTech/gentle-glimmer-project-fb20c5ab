import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, Building2, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useReportSignaturesRealtime, type SignatureEntry } from '@/hooks/useReportSignaturesRealtime';
import { SignatureImage } from '@/components/signatures/SignatureImage';
import { getSignatureKind } from '@/lib/signatureImage';
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
        'p-3 rounded-lg border transition-colors',
        entry.signed ? 'bg-[hsl(var(--success))]/5 border-[hsl(var(--success))]/20' : 'bg-muted/30 border-border',
      )}
    >
      <div className="flex items-center gap-3">
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
        <p className="text-xs text-muted-foreground truncate">{entry.role || '—'}</p>
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
      {entry.signed && getSignatureKind(entry.signatureData) !== 'none' && (
        <div className="mt-3 min-h-28 w-full overflow-visible bg-background rounded-md border border-border/50 p-1">
          <SignatureImage
            value={entry.signatureData}
            signerName={entry.name}
            alt={`Assinatura de ${entry.name}`}
            className="h-28 w-full"
          />
        </div>
      )}
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
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3 text-sm">
        <Badge variant="secondary">{summary.signed}/{summary.total} assinadas</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))] animate-pulse" />
          Tempo real
        </span>
      </div>

      {/* WEES */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
            {weesCompanyName}
          </h3>
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
          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
            {clientCompanyName}
          </h3>
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
