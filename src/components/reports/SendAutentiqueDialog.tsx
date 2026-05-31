import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Send, Loader2, Check, Building2, AlertCircle, Factory, Mail, MessageCircle,
  Search, UserCheck, FileSignature, X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { generateReportPdfAsBlob } from '@/lib/generateReportPdf';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Report, Company, Site, Project,
  Shift, DeviationType, ImpactLevel, ReportStatus,
} from '@/types';

interface SendAutentiqueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: any;
  company: any;
  site: any;
  project: any;
}

interface ContactRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  avatar_url: string | null;
  preferred_channel: 'email' | 'whatsapp';
}

interface WeesSigner {
  name: string;
  email: string;
  role: string | null;
  signatureData: string | null;
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip the data URL prefix
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export function SendAutentiqueDialog({
  open,
  onOpenChange,
  report,
  company,
  site,
  project,
}: SendAutentiqueDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [weesSigner, setWeesSigner] = useState<WeesSigner | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Load logged-in WEES profile (signature data)
  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, email, job_title, signature_data')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.name && data?.email) {
        setWeesSigner({
          name: data.name,
          email: data.email,
          role: (data as any).job_title ?? null,
          signatureData: (data as any).signature_data ?? null,
        });
      } else {
        setWeesSigner(null);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user?.id]);

  // Load active client contacts for this site (or company as fallback)
  useEffect(() => {
    if (!open) return;
    const siteId = site?.id ?? null;
    const companyId = company?.id ?? null;
    if (!siteId && !companyId) {
      setContacts([]);
      return;
    }
    let cancelled = false;
    setContactsLoading(true);
    (async () => {
      try {
        let contactIds: string[] | null = null;
        if (siteId) {
          const { data: cs } = await supabase
            .from('contact_sites')
            .select('contact_id')
            .eq('site_id', siteId);
          contactIds = (cs ?? []).map((r) => r.contact_id);
        }

        let query = supabase
          .from('company_contacts')
          .select('id, name, email, phone, role, avatar_url')
          .eq('is_active', true);

        if (contactIds && contactIds.length > 0) {
          query = query.in('id', contactIds);
        } else if (companyId) {
          query = query.eq('company_id', companyId);
        } else {
          if (!cancelled) setContacts([]);
          return;
        }

        const { data, error } = await query.order('name');
        if (error) throw error;
        if (cancelled) return;

        const rows: ContactRow[] = (data ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone ?? null,
          role: c.role ?? null,
          avatar_url: c.avatar_url ?? null,
          preferred_channel: c.email ? 'email' : (c.phone ? 'whatsapp' : 'email'),
        }));
        setContacts(rows);

        // Auto-select ALL contacts for the unit
        if (cancelled) return;
        const allContactIds = new Set<string>(rows.map((r) => r.id));
        setSelectedIds(allContactIds);
      } catch (e) {
        console.error('Error loading client contacts:', e);
        if (!cancelled) setContacts([]);
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, site?.id, company?.id, report?.id]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.role ?? '').toLowerCase().includes(q),
    );
  }, [contacts, search]);

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const buildPdfData = () => {
    const reportForPdf: Report = {
      id: report.id,
      date: parseISO(report.date),
      shift: report.shift as Shift,
      activityLocation: report.location || '',
      startTime: report.start_time || '',
      endTime: report.end_time || '',
      status: report.status as ReportStatus,
      comments: report.comments || '',
      projectId: project.id,
      projectName: project.name,
      teamId: report.team_id || '',
      teamName: report.team?.name || '',
      createdById: report.created_by || '',
      createdByName: report.creator?.name || '',
      maintenanceOrderTitle: report.location || '',
      activities: (report.activities || []).map((a: any, index: number) => ({
        id: a.id,
        reportId: report.id,
        description: a.description,
        completed: a.completed,
        order: index,
      })),
      deviations: (report.deviations || []).map((d: any) => ({
        id: d.id,
        reportId: report.id,
        type: d.type as DeviationType,
        description: d.description,
        impact: d.impact as ImpactLevel,
        correctiveAction: d.action_taken,
        resolved: false,
      })),
      attendance: (report.attendance || []).map((a: any) => ({
        id: a.id,
        reportId: report.id,
        userId: a.user_id || '',
        userName: a.user_name,
        present: a.present,
        arrivalTime: a.arrival_time,
        departureTime: a.departure_time,
        functionRole: a.function_role,
      })),
      photos: (report.photos || []).map((p: any) => ({
        id: p.id,
        reportId: report.id,
        url: p.url,
        description: p.description,
        uploadedAt: new Date(p.created_at || Date.now()),
      })),
      signatures: [],
      createdAt: new Date(report.created_at || Date.now()),
      updatedAt: new Date(report.updated_at || Date.now()),
    };

    const companyForPdf: Company = {
      id: company.id,
      name: company.name,
      cnpj: company.cnpj || '',
      logo: company.logo_url || undefined,
      address: company.address || undefined,
      phone: company.phone || undefined,
      email: company.email || undefined,
      active: true,
      createdAt: new Date(company.created_at || Date.now()),
    };

    const siteForPdf: Site = {
      id: site.id,
      companyId: site.company_id,
      name: site.name,
      city: site.city || '',
      state: site.state || '',
      address: site.address || undefined,
      active: true,
      createdAt: new Date(site.created_at || Date.now()),
    };

    const projectForPdf: Project = {
      id: project.id,
      companyId: project.company_id,
      siteId: project.site_id,
      name: project.name,
      code: project.code || '',
      location: '',
      startDate: new Date(project.start_date || Date.now()),
      expectedEndDate: project.end_date ? new Date(project.end_date) : undefined,
      status: (project.status || 'in_progress') as any,
      supervisorId: '',
      active: true,
    };

    return { reportForPdf, companyForPdf, siteForPdf, projectForPdf };
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!weesSigner) {
      toast.error('Perfil não carregado. Recarregue a página e tente novamente.');
      return;
    }
    if (!weesSigner.signatureData) {
      toast.error('Cadastre sua assinatura no Perfil antes de enviar.');
      return;
    }
    if (selectedIds.size === 0) {
      toast.error('Selecione ao menos 1 signatário do cliente.');
      return;
    }

    setIsSending(true);
    try {
      // 1) Insert WEES signature in report_signatures (if not already there for this user)
      const { data: existingSig } = await supabase
        .from('report_signatures')
        .select('id')
        .eq('report_id', report.id)
        .eq('signer_user_id', user.id)
        .maybeSingle();

      if (!existingSig) {
        const { error: sigErr } = await supabase
          .from('report_signatures')
          .insert({
            report_id: report.id,
            signature_data: weesSigner.signatureData,
            signer_name: weesSigner.name,
            signer_role: weesSigner.role || 'Equipe WEES',
            signer_email: weesSigner.email,
            signer_user_id: user.id,
            legal_basis: 'MP 2.200-2/2001',
          });
        if (sigErr) throw sigErr;
      }

      // 2) Build PDF with WEES signature embedded
      const { data: systemSettings } = await supabase
        .from('system_settings')
        .select('primary_color, accent_color, logo_url, pdf_logo_url')
        .limit(1)
        .single();

      const tenantColors = systemSettings ? {
        primary_color: systemSettings.primary_color,
        accent_color: systemSettings.accent_color,
        logo_url: systemSettings.logo_url,
        pdf_logo_url: systemSettings.pdf_logo_url,
      } : undefined;

      const { reportForPdf, companyForPdf, siteForPdf, projectForPdf } = buildPdfData();

      const weesSignatureForPdf = {
        id: 'wees-internal',
        reportId: report.id,
        signerName: weesSigner.name,
        signerRole: weesSigner.role || 'Equipe WEES',
        signatureData: weesSigner.signatureData ?? '',
        signedAt: new Date().toISOString(),
      };

      const baseSignatures = (report.signatures || []).map((s: any) => ({
        id: s.id,
        reportId: s.report_id,
        signerName: s.signer_name,
        signerRole: s.signer_role ?? undefined,
        signatureData: s.signature_data,
        signedAt: s.signed_at ?? new Date().toISOString(),
        ipAddress: s.ip_address ?? undefined,
      }));

      const hasWees = baseSignatures.some((s: any) => s.signerName === weesSigner.name);
      const allSignatures = hasWees ? baseSignatures : [...baseSignatures, weesSignatureForPdf];

      const blob = await generateReportPdfAsBlob(
        reportForPdf,
        companyForPdf,
        siteForPdf,
        projectForPdf,
        allSignatures as any,
        tenantColors,
      );

      // 3) Upload PDF to storage
      const rdoNumber = (report.rdo_number ?? 1).toString().padStart(3, '0');
      const fileDate = format(parseISO(report.date), 'yyyy-MM-dd');
      const safeCompany = (company?.name ?? 'empresa').replace(/[^\w\-]+/g, '_');
      const filePath = `${company.id}/${report.id}/RDO-${rdoNumber}-${safeCompany}-${fileDate}-${Date.now()}.pdf`;

      const { error: uploadErr } = await supabase.storage
        .from('report-pdfs')
        .upload(filePath, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('report-pdfs')
        .getPublicUrl(filePath);
      const publicUrl = publicUrlData?.publicUrl ?? null;

      // 4) Upsert approvers (pending) for selected contacts
      const ids = Array.from(selectedIds);
      const approverRows = ids.map((contactId) => ({
        report_id: report.id,
        contact_id: contactId,
        status: 'pending',
        created_by: user.id,
      }));
      const { error: approverErr } = await supabase
        .from('report_company_approvers')
        .upsert(approverRows, { onConflict: 'report_id,contact_id', ignoreDuplicates: true });
      if (approverErr) throw approverErr;

      // 5) Update report: status = sent, sent_at = now(), signed_pdf_url
      const { error: updateErr } = await supabase
        .from('reports')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          ...(publicUrl ? { signed_pdf_url: publicUrl } : {}),
        } as any)
        .eq('id', report.id);
      if (updateErr) throw updateErr;

      // 6) Refresh caches
      await queryClient.invalidateQueries({ queryKey: ['report', report.id] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      await queryClient.invalidateQueries({ queryKey: ['client-dashboard-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-client-dashboard-reports'] });

      toast.success(`RDO enviado para o portal do cliente — ${ids.length} contato(s) da unidade ${site?.name || ''} verão e poderão assinar.`);

      // Reset and close
      setSelectedIds(new Set());
      setSearch('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending RDO to client portal:', error);
      toast.error(error?.message ?? 'Erro ao enviar para assinatura.');
    } finally {
      setIsSending(false);
    }
  };

  const allSelected =
    filteredContacts.length > 0 && selectedIds.size === filteredContacts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Enviar para Assinatura
            {report?.rdo_number && (
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                RDO Nº {report.rdo_number.toString().padStart(3, '0')}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            O PDF será gerado <strong>já com a assinatura da equipe WEES</strong> e enviado
            para o portal do cliente. Os signatários selecionados verão o RDO e poderão assinar
            diretamente no portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* WEES signer card */}
          {weesSigner ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Assinatura WEES (você)
              </Label>
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{weesSigner.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {weesSigner.role ?? weesSigner.email}
                      </p>
                    </div>
                    {weesSigner.signatureData ? (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                  </div>
                  {!weesSigner.signatureData && (
                    <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">
                        Você ainda não cadastrou sua assinatura. Configure em Configurações → Perfil
                        antes de enviar.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Perfil não encontrado</p>
                <p className="text-muted-foreground text-xs">
                  Não foi possível carregar seus dados. Verifique seu perfil.
                </p>
              </div>
            </div>
          )}

          {/* Client signers summary list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Factory className="w-4 h-4" />
                Destinatários da unidade {site?.name}
              </Label>
              {contacts.length > 0 && (
                <Badge variant="secondary" className="font-normal">
                  {contacts.length} {contacts.length === 1 ? 'contato' : 'contatos'}
                </Badge>
              )}
            </div>

            {contactsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Carregando contatos…
              </div>
            ) : contacts.length === 0 ? (
              <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 text-center text-sm text-destructive">
                <p className="font-medium">Nenhum contato cadastrado para esta unidade.</p>
                <p className="text-xs opacity-80 mt-1">
                  Cadastre contatos em Configurações → Portal do Cliente → Contatos antes de enviar.
                </p>
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-0">
                  <div className="divide-y">
                    {contacts.slice(0, 5).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 p-2.5"
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
                            {c.role || (c.preferred_channel === 'whatsapp' ? c.phone : c.email)}
                          </p>
                        </div>
                        <Check className="h-4 w-4 text-green-600 shrink-0" />
                      </div>
                    ))}
                    {contacts.length > 5 && (
                      <div className="p-2 text-center text-xs text-muted-foreground bg-muted/30">
                        + {contacts.length - 5} outros contatos da unidade
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {contacts.length > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50/50 border border-blue-100/50">
                <UserCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Este RDO será enviado automaticamente para todos os contatos ativos desta unidade no portal do cliente.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleSubmit}
            disabled={
              isSending ||
              !weesSigner?.signatureData ||
              contacts.length === 0
            }
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar para o portal do cliente
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Small util to keep TS happy when a non-null signature is required
function weesSignerOrPlaceholder(data: string | null): string {
  return data ?? '';
}
