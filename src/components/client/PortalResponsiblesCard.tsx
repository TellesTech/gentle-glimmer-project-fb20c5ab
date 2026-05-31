import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Building2, Users, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { usePortalResponsibles, type PortalPerson } from '@/hooks/usePortalResponsibles';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface Props {
  companyId?: string | null;
  siteIds?: string[];
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

function PersonRow({ person }: { person: PortalPerson }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
      <Avatar className="h-9 w-9 shrink-0">
        {person.avatar_url ? <AvatarImage src={person.avatar_url} alt={person.name} /> : null}
        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
          {initials(person.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{person.name}</p>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          <span className="truncate">{person.role}</span>
          {person.companyName ? (
            <>
              <span className="opacity-50">·</span>
              <Building2 className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate font-medium">{person.companyName}</span>
            </>
          ) : null}
        </p>
      </div>
      {person.hasSignature ? (
        <Badge variant="outline" className="border-[hsl(var(--success))]/40 text-[hsl(var(--success))] text-[10px] gap-1 shrink-0">
          <CheckCircle2 className="h-3 w-3" /> Assinatura
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1 shrink-0">
          <AlertCircle className="h-3 w-3" /> Sem assinatura
        </Badge>
      )}
    </div>
  );
}

export function PortalResponsiblesCard({ companyId, siteIds }: Props) {
  const { data, isLoading } = usePortalResponsibles({ companyId, siteIds });
  const [weesOpen, setWeesOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);

  if (!companyId) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* WEES Team */}
      <Collapsible open={weesOpen} onOpenChange={setWeesOpen}>
        <Card className="overflow-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors select-none">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Equipe WEES
                </CardTitle>
                <div className="flex items-center gap-2">
                  {!isLoading && (
                    <Badge variant="secondary">{data?.wees.length ?? 0}</Badge>
                  )}
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", weesOpen && "rotate-180")} />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-2 sm:p-3 pt-0">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : data && data.wees.length > 0 ? (
                <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                  {data.wees.map((p) => <PersonRow key={p.id} person={p} />)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum responsável WEES vinculado.
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Client Team */}
      <Collapsible open={clientOpen} onOpenChange={setClientOpen}>
        <Card className="overflow-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors select-none">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {(() => {
                    const factory = data?.client.find((p) => p.companyName)?.companyName;
                    return factory ? `Equipe (${factory})` : 'Equipe Cliente';
                  })()}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {!isLoading && (
                    <Badge variant="secondary">{data?.client.length ?? 0}</Badge>
                  )}
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", clientOpen && "rotate-180")} />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-2 sm:p-3 pt-0">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : data && data.client.length > 0 ? (
                <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                  {data.client.map((p) => <PersonRow key={p.id} person={p} />)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum responsável do cliente cadastrado.
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
