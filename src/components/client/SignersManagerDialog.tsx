import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** RDOs afetados (uma pasta inteira, um mês ou um único RDO) */
  reportIds: string[];
  siteId?: string | null;
  companyId?: string | null;
  /** Texto do que está sendo alterado (ex.: nome da pasta) */
  scopeLabel?: string;
}

interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  avatar_url: string | null;
}

export function SignersManagerDialog({
  open,
  onOpenChange,
  reportIds,
  siteId,
  companyId,
  scopeLabel,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['portal-signers', siteId, companyId, reportIds.join(',')],
    enabled: open && reportIds.length > 0 && (!!siteId || !!companyId),
    queryFn: async () => {
      // Contatos da unidade (ou da empresa, quando não há vínculo por unidade)
      let contactIds: string[] = [];
      if (siteId) {
        const { data: cs } = await supabase.from('contact_sites').select('contact_id').eq('site_id', siteId);
        contactIds = ((cs || []) as any[]).map((r) => r.contact_id);
      }

      let query = supabase
        .from('company_contacts')
        .select('id, name, email, role, avatar_url')
        .eq('is_active', true);
      if (contactIds.length > 0) query = query.in('id', contactIds);
      else if (companyId) query = query.eq('company_id', companyId);
      else return { contacts: [] as ContactRow[], assigned: new Map<string, number>(), approved: new Map<string, number>() };

      const { data: contacts } = await query.order('name');

      const { data: approvers } = await supabase
        .from('report_company_approvers')
        .select('contact_id, status')
        .in('report_id', reportIds);

      const assigned = new Map<string, number>();
      const approved = new Map<string, number>();
      ((approvers || []) as any[]).forEach((a) => {
        assigned.set(a.contact_id, (assigned.get(a.contact_id) || 0) + 1);
        if (a.status === 'approved') approved.set(a.contact_id, (approved.get(a.contact_id) || 0) + 1);
      });

      return { contacts: (contacts || []) as ContactRow[], assigned, approved };
    },
  });

  const contacts = data?.contacts ?? [];

  useEffect(() => {
    if (!open || !data) return;
    // Marca quem já está indicado em pelo menos um dos RDOs do escopo
    setSelected(new Set(Array.from(data.assigned.keys())));
  }, [open, data]);

  const summary = useMemo(() => {
    const total = reportIds.length;
    return `${total} RDO${total > 1 ? 's' : ''}${scopeLabel ? ` • ${scopeLabel}` : ''}`;
  }, [reportIds.length, scopeLabel]);

  const handleSave = async () => {
    if (!reportIds.length) return;
    setSaving(true);
    try {
      const chosen = Array.from(selected);
      const toRemove = contacts.map((c) => c.id).filter((id) => !selected.has(id));

      if (chosen.length > 0) {
        const rows = reportIds.flatMap((reportId) =>
          chosen.map((contactId) => ({
            report_id: reportId,
            contact_id: contactId,
            status: 'pending',
            created_by: user?.id ?? null,
          })),
        );
        const { error } = await supabase
          .from('report_company_approvers')
          .upsert(rows as any, { onConflict: 'report_id,contact_id', ignoreDuplicates: true });
        if (error) throw error;
      }

      if (toRemove.length > 0) {
        // Preserva quem já assinou
        const { error } = await supabase
          .from('report_company_approvers')
          .delete()
          .in('report_id', reportIds)
          .in('contact_id', toRemove)
          .neq('status', 'approved');
        if (error) throw error;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['portal-signers'] }),
        queryClient.invalidateQueries({ queryKey: ['client-dashboard-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['client-activity-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['client-signed-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['portal-responsibles'] }),
      ]);

      toast.success('Signatários atualizados.');
      onOpenChange(false);
    } catch (e: any) {
      console.error('Erro ao salvar signatários:', e);
      toast.error(e?.message || 'Não foi possível salvar os signatários.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Definir signatários
          </DialogTitle>
          <DialogDescription>
            Somente as pessoas marcadas verão e poderão assinar. {summary}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando contatos…
          </div>
        ) : contacts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum contato ativo cadastrado para esta unidade.
          </p>
        ) : (
          <div className="divide-y rounded-lg border max-h-72 overflow-y-auto">
            {contacts.map((c) => {
              const checked = selected.has(c.id);
              const signedCount = data?.approved.get(c.id) || 0;
              const assignedCount = data?.assigned.get(c.id) || 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    })
                  }
                  className={cn(
                    'w-full flex items-center gap-3 p-2.5 text-left transition-colors',
                    checked ? 'bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {c.avatar_url && <AvatarImage src={c.avatar_url} alt={c.name} />}
                    <AvatarFallback className="text-xs bg-muted">
                      {c.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {signedCount > 0
                        ? `Já assinou ${signedCount} de ${assignedCount} RDO(s) desta seleção`
                        : c.role || c.email || 'Cliente'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'h-5 w-5 rounded-md border flex items-center justify-center shrink-0',
                      checked ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30',
                    )}
                  >
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || contacts.length === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
