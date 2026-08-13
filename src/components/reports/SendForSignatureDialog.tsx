import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Send, Loader2, Check, Building2, AlertCircle, Factory, Mail, MessageCircle,
  Search, UserCheck, FileSignature, X, PenTool
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
import { supabase } from '@/integrations/supabase/loose-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { SignatureImage } from '@/components/signatures/SignatureImage';
import type {
  Report, Company, Site, Project,
  Shift, DeviationType, ImpactLevel, ReportStatus,
} from '@/types';

interface SendForSignatureDialogProps {
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

export function SendForSignatureDialog({
  open,
  onOpenChange,
  report,
  company,
  site,
  project,
}: SendForSignatureDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [weesSigner, setWeesSigner] = useState<WeesSigner | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [signerType, setSignerType] = useState<'wees' | 'client'>('client');

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
        const allContactIds = new Set<string>(
          rows
            .filter(r => normalize(r.name) !== 'alex manhaes')
            .map((r) => r.id)
        );
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

  const normalize = (s: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = contacts.filter(c => normalize(c.name) !== 'alex manhaes');
    if (!q) return list;
    return list.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.role ?? '').toLowerCase().includes(q),
    );
  }, [contacts, search]);

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
    
    if (signerType === 'wees') {
      if (!weesSigner) {
        toast.error('Perfil não carregado. Recarregue a página e tente novamente.');
        return;
      }
      if (!weesSigner.signatureData) {
        toast.error('Cadastre sua assinatura no Perfil antes de assinar.');
        return;
      }
    } else {
      if (selectedIds.size === 0) {
        toast.error('Selecione ao menos 1 signatário do cliente.');
        return;
      }
    }

    setIsSending(true);
    try {
      if (signerType === 'wees') {
        // Just register the WEES signature and we're done
        const { error: sigErr } = await supabase
          .from('report_signatures')
          .insert({
            report_id: report.id,
            signature_data: weesSigner!.signatureData,
            signer_name: weesSigner!.name,
            signer_role: weesSigner!.role || 'Equipe WEES',
            signer_email: weesSigner!.email,
            signer_user_id: user.id,
            legal_basis: 'MP 2.200-2/2001',
          });
        if (sigErr) throw sigErr;

        await queryClient.invalidateQueries({ queryKey: ['report', report.id] });
        toast.success('Assinatura WEES registrada com sucesso!');
        onOpenChange(false);
        return;
      }

      // 1) Insert WEES signature if sending to client and not already signed
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
            signature_data: weesSigner!.signatureData,
            signer_name: weesSigner!.name,
            signer_role: weesSigner!.role || 'Equipe WEES',
            signer_email: weesSigner!.email,
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
        signerName: weesSigner!.name,
        signerRole: weesSigner!.role || 'Equipe WEES',
        signatureData: weesSigner!.signatureData ?? '',
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

      const hasWees = baseSignatures.some((s: any) => s.signerName === weesSigner!.name);
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
      const filePath = `signed-report-pdfs/${company.id}/${report.id}/RDO-${rdoNumber}-${safeCompany}-${fileDate}-${Date.now()}.pdf`;

      const { error: uploadErr } = await supabase.storage
        .from('service-report-photos')
        .upload(filePath, blob, {
          contentType: 'application/pdf',
          upsert: false,
        });
      if (uploadErr) {
        console.error('PDF upload error:', uploadErr);
        throw new Error(
          `Não foi possível salvar o PDF assinado: ${uploadErr.message || 'erro desconhecido'}`,
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from('service-report-photos')
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Assinatura Eletrônica
            {report?.rdo_number && (
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                RDO Nº {report.rdo_number.toString().padStart(3, '0')}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Escolha quem deve assinar este documento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Signer Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Selecione o Signatário:</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={signerType === 'wees' ? 'default' : 'outline'}
                className={cn(
                  "h-auto py-4 flex flex-col gap-2 border-2",
                  signerType === 'wees' ? "border-primary bg-primary/10 text-primary hover:bg-primary/20" : "border-muted"
                )}
                onClick={() => setSignerType('wees')}
              >
                <Building2 className="w-6 h-6" />
                <div className="text-center">
                  <p className="font-bold text-xs uppercase tracking-wider">Responsável Wees</p>
                  <p className="text-[10px] opacity-70 font-normal">Assinatura interna</p>
                </div>
              </Button>

              <Button
                type="button"
                variant={signerType === 'client' ? 'default' : 'outline'}
                className={cn(
                  "h-auto py-4 flex flex-col gap-2 border-2",
                  signerType === 'client' ? "border-primary bg-primary/10 text-primary hover:bg-primary/20" : "border-muted"
                )}
                onClick={() => setSignerType('client')}
              >
                <UserCheck className="w-6 h-6" />
                <div className="text-center">
                  <p className="font-bold text-xs uppercase tracking-wider">Cliente</p>
                  <p className="text-[10px] opacity-70 font-normal">Enviar para o portal</p>
                </div>
              </Button>
            </div>
          </div>

          {signerType === 'wees' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-primary/20">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {weesSigner?.name ? weesSigner.name.substring(0, 2).toUpperCase() : 'W'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{weesSigner?.name || 'Carregando...'}</p>
                    <p className="text-xs text-muted-foreground truncate">{weesSigner?.role || weesSigner?.email}</p>
                  </div>
                </div>

                {!weesSigner?.signatureData ? (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-destructive">Assinatura não cadastrada</p>
                      <p className="text-[10px] text-destructive/80">Você precisa cadastrar sua firma no perfil antes de assinar.</p>
                    </div>
                    <Button variant="link" size="sm" className="text-destructive font-bold p-0 h-auto underline" onClick={() => window.location.href = '/settings'}>
                      Ir para Perfil
                    </Button>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg p-2 border border-primary/10">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 px-1">Prévia da Assinatura</p>
                    <SignatureImage value={weesSigner.signatureData} signerName={weesSigner.name} className="h-24 w-full" alt="Assinatura" />
                  </div>
                )}
              </div>
              
              <Button 
                className="w-full h-12 text-sm font-bold shadow-lg shadow-primary/20" 
                onClick={handleSubmit} 
                disabled={isSending || !weesSigner?.signatureData}
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PenTool className="w-4 h-4 mr-2" />}
                Confirmar Assinatura WEES
              </Button>
            </div>
          )}

          {signerType === 'client' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
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
                      Cadastre contatos em Configurações → Portal do Cliente antes de enviar.
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

              <Button 
                className="w-full h-12 text-sm font-bold shadow-lg shadow-primary/20" 
                onClick={handleSubmit} 
                disabled={isSending || contacts.length === 0 || !weesSigner?.signatureData}
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {weesSigner?.signatureData ? 'Assinar e Enviar para o Cliente' : 'Cadastre sua firma para enviar'}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-start">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
            className="w-full sm:w-auto"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
