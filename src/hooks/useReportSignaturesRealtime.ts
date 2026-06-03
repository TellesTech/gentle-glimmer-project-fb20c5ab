import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SignatureEntry {
  key: string;
  name: string;
  role: string | null;
  email: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  side: 'wees' | 'client';
  signed: boolean;
  signedAt: string | null;
  signatureData: string | null;
}

/**
 * Builds a unified signature timeline for a report:
 * - WEES side: pre-populates with project/site responsibles (profiles via
 *   site_responsibles + portal_admin_access). Marks as `signed` if a matching
 *   `report_signatures` row exists.
 * - Client side: pre-populates with company_contacts + client_profiles linked
 *   to the report's company. Marks as `signed` based on approver status or
 *   recorded signature.
 *
 * The panel always shows WHO is responsible for signing, even before approvers
 * are formally designated. Realtime updates keep statuses fresh.
 */
export function useReportSignaturesRealtime(reportId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['report-signature-timeline', reportId];

  const query = useQuery({
    queryKey,
    enabled: !!reportId,
    staleTime: 15_000,
    queryFn: async () => {
      if (!reportId) return { entries: [] as SignatureEntry[] };

      // 1) Resolve report -> project -> site -> company
      const { data: report } = await supabase
        .from('reports')
        .select('id, project:projects(id, site:sites(id, company:companies(id, name)))')
        .eq('id', reportId)
        .maybeSingle();

      const siteId = (report as any)?.project?.site?.id || null;
      const companyId = (report as any)?.project?.site?.company?.id || null;
      const clientCompanyName = (report as any)?.project?.site?.company?.name || null;

      // WEES brand name + lista de assinantes ad-hoc considerados internos (sem email)
      const [{ data: branding }, { data: settings }] = await Promise.all([
        (supabase as any).rpc('get_public_branding'),
        (supabase as any).from('system_settings').select('internal_signer_names').limit(1).maybeSingle(),
      ]);
      const weesCompanyName = (branding?.[0] as any)?.system_name || 'WEES';
      const normalize = (s: string) =>
        (s || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
      const internalSignerNames = new Set<string>(
        ((settings?.internal_signer_names as string[]) || []).map(normalize),
      );

      // 2) Recorded signatures + approvers + responsibles in parallel
      const [
        { data: signatures },
        { data: clientApprovers },
        { data: contactApprovers },
        weesUserIdsRes,
        contactsRes,
        clientProfilesRes,
      ] = await Promise.all([
        supabase
          .from('report_signatures')
          .select('id, signer_name, signer_role, signer_email, signer_user_id, signed_at, signature_data')
          .eq('report_id', reportId)
          .order('signed_at', { ascending: true }),
        supabase
          .from('report_client_approvers')
          .select('id, client_id, status, approved_at, client:client_profiles(id, name, email, role)')
          .eq('report_id', reportId),
        supabase
          .from('report_company_approvers')
          .select('id, contact_id, status, approved_at, contact:company_contacts(id, name, email, role, avatar_url)')
          .eq('report_id', reportId),
        // WEES responsibles for this site
        siteId
          ? Promise.all([
              supabase.from('portal_admin_access').select('user_id').eq('site_id', siteId),
              supabase.from('site_responsibles').select('user_id').eq('site_id', siteId),
            ]).then(([{ data: paa }, { data: sr }]) => {
              const set = new Set<string>();
              (paa || []).forEach((r: any) => r.user_id && set.add(r.user_id));
              (sr || []).forEach((r: any) => r.user_id && set.add(r.user_id));
              return Array.from(set);
            })
          : Promise.resolve([] as string[]),
        // Client contacts for this company
        companyId
          ? supabase
              .from('company_contacts')
              .select('id, name, email, role, avatar_url, signature_data, is_active')
              .eq('company_id', companyId)
              .eq('is_active', true)
          : Promise.resolve({ data: [] as any[] } as any),
        // Client profiles for this company
        companyId
          ? supabase
              .from('client_profiles')
              .select('id, name, email, role, signature_data, is_active')
              .eq('company_id', companyId)
              .eq('is_active', true)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      const weesUserIds = (weesUserIdsRes as string[]) || [];
      const contacts = (contactsRes as any).data || [];
      const clientProfilesList = (clientProfilesRes as any).data || [];

      // 3) WEES profiles
      let weesProfiles: any[] = [];
      if (weesUserIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, email, job_title, avatar_url')
          .in('id', weesUserIds);
        weesProfiles = profs || [];
      }

      const weesEmailSet = new Set<string>(
        weesProfiles.map((p) => (p.email || '').toLowerCase()).filter(Boolean),
      );

      // Quick lookup of recorded signatures
      const sigByEmail = new Map<string, any>();
      const sigByUserId = new Map<string, any>();
      (signatures || []).forEach((s: any) => {
        if (s.signer_email) sigByEmail.set(s.signer_email.toLowerCase(), s);
        if (s.signer_user_id) sigByUserId.set(s.signer_user_id, s);
      });

      // 4) WEES entries from project responsibles
      const weesEntries: SignatureEntry[] = weesProfiles.map((p) => {
        const sig = sigByUserId.get(p.id) || (p.email ? sigByEmail.get(p.email.toLowerCase()) : null);
        return {
          key: `wees-${p.id}`,
          name: p.name || 'Sem nome',
          role: p.job_title || 'Equipe WEES',
          email: p.email,
          avatarUrl: p.avatar_url || null,
          companyName: weesCompanyName,
          side: 'wees',
          signed: !!sig,
          signedAt: sig?.signed_at || null,
          signatureData: sig?.signature_data || null,
        };
      });

      // Ad-hoc WEES signatures (signers not in responsibles list).
      // Considera interno se: email está no weesEmailSet OU o nome está em internalSignerNames
      // (cobre assinaturas via WhatsApp/portal sem email).
      (signatures || []).forEach((s: any) => {
        const email = (s.signer_email || '').toLowerCase();
        const nameKey = normalize(s.signer_name || '');
        const isInternalByEmail = !!email && weesEmailSet.has(email);
        const isInternalByName = !email && !!nameKey && internalSignerNames.has(nameKey);
        const isInternal = isInternalByEmail || isInternalByName;
        const alreadyListed = weesEntries.some(
          (e) =>
            (email && (e.email || '').toLowerCase() === email) ||
            (!email && normalize(e.name) === nameKey),
        );
        if (isInternal && !alreadyListed) {
          weesEntries.push({
            key: `sig-${s.id}`,
            name: s.signer_name || 'Assinante',
            role: s.signer_role && s.signer_role !== 'Cliente' ? s.signer_role : 'Equipe WEES',
            email: s.signer_email,
            avatarUrl: null,
            companyName: weesCompanyName,
            side: 'wees',
            signed: true,
            signedAt: s.signed_at,
            signatureData: s.signature_data,
          });
        }
      });

      // 5) Client entries: approvers + contacts + client_profiles
      const clientEntries: SignatureEntry[] = [];
      const seenClientEmails = new Set<string>();
      const seenClientKeys = new Set<string>();

      (clientApprovers || []).forEach((a: any) => {
        const c = a.client;
        if (!c) return;
        const email = (c.email || '').toLowerCase();
        if (email) seenClientEmails.add(email);
        const sig = email ? sigByEmail.get(email) : null;
        clientEntries.push({
          key: `cp-${a.id}`,
          name: c.name || 'Cliente',
          role: c.role || 'Cliente',
          email: c.email,
          avatarUrl: null,
          companyName: clientCompanyName,
          side: 'client',
          signed: a.status === 'approved' || !!sig,
          signedAt: a.approved_at || sig?.signed_at || null,
          signatureData: sig?.signature_data || null,
        });
        seenClientKeys.add(`cp-client-${c.id}`);
      });

      (contactApprovers || []).forEach((a: any) => {
        const c = a.contact;
        if (!c) return;
        const email = (c.email || '').toLowerCase();
        if (email && seenClientEmails.has(email)) return;
        if (email) seenClientEmails.add(email);
        const sig = email ? sigByEmail.get(email) : null;
        clientEntries.push({
          key: `cc-${a.id}`,
          name: c.name || 'Cliente',
          role: c.role || 'Cliente',
          email: c.email,
          avatarUrl: c.avatar_url || null,
          companyName: clientCompanyName,
          side: 'client',
          signed: a.status === 'approved' || !!sig,
          signedAt: a.approved_at || sig?.signed_at || null,
          signatureData: sig?.signature_data || null,
        });
        seenClientKeys.add(`cc-contact-${c.id}`);
      });

      // Pre-populate with company contacts not already added (pending)
      contacts.forEach((c: any) => {
        if (seenClientKeys.has(`cc-contact-${c.id}`)) return;
        const email = (c.email || '').toLowerCase();
        if (email && seenClientEmails.has(email)) return;
        if (email) seenClientEmails.add(email);
        const sig = email ? sigByEmail.get(email) : null;
        clientEntries.push({
          key: `contact-${c.id}`,
          name: c.name || 'Cliente',
          role: c.role || 'Cliente',
          email: c.email,
          avatarUrl: c.avatar_url || null,
          companyName: clientCompanyName,
          side: 'client',
          signed: !!sig,
          signedAt: sig?.signed_at || null,
          signatureData: sig?.signature_data || null,
        });
      });

      // Pre-populate with client profiles not already added (pending)
      clientProfilesList.forEach((c: any) => {
        if (seenClientKeys.has(`cp-client-${c.id}`)) return;
        const email = (c.email || '').toLowerCase();
        if (email && seenClientEmails.has(email)) return;
        if (email) seenClientEmails.add(email);
        const sig = email ? sigByEmail.get(email) : null;
        clientEntries.push({
          key: `client-${c.id}`,
          name: c.name || 'Cliente',
          role: c.role || 'Cliente',
          email: c.email,
          avatarUrl: null,
          companyName: clientCompanyName,
          side: 'client',
          signed: !!sig,
          signedAt: sig?.signed_at || null,
          signatureData: sig?.signature_data || null,
        });
      });

      // Ad-hoc client signatures not matched to anyone above.
      // Exclui também assinantes ad-hoc cujo nome esteja na lista de internos (já tratados acima).
      (signatures || []).forEach((s: any) => {
        const email = (s.signer_email || '').toLowerCase();
        const nameKey = normalize(s.signer_name || '');
        const isInternalByEmail = !!email && weesEmailSet.has(email);
        const isInternalByName = !email && !!nameKey && internalSignerNames.has(nameKey);
        if (isInternalByEmail || isInternalByName) return;
        if (email && seenClientEmails.has(email)) return;
        clientEntries.push({
          key: `sig-${s.id}`,
          name: s.signer_name || 'Assinante',
          role: s.signer_role || 'Cliente',
          email: s.signer_email,
          avatarUrl: null,
          companyName: clientCompanyName,
          side: 'client',
          signed: true,
          signedAt: s.signed_at,
          signatureData: s.signature_data,
        });
      });

      const sortByName = (a: SignatureEntry, b: SignatureEntry) =>
        a.name.localeCompare(b.name, 'pt-BR');

      const entries = [...weesEntries.sort(sortByName), ...clientEntries.sort(sortByName)];

      return { entries };
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    if (!reportId) return;
    const channel = supabase
      .channel(`signature-timeline-${reportId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_signatures', filter: `report_id=eq.${reportId}` }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_client_approvers', filter: `report_id=eq.${reportId}` }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_company_approvers', filter: `report_id=eq.${reportId}` }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const summary = useMemo(() => {
    const entries = query.data?.entries || [];
    const total = entries.length;
    const signed = entries.filter((e) => e.signed).length;
    return { total, signed, pending: total - signed };
  }, [query.data]);

  return { ...query, summary };
}
