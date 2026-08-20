import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminSiteAccess } from '@/hooks/useAdminSiteAccess';
import { ProjectSelector } from '@/components/reports/ProjectSelector';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2 } from 'lucide-react';
import { describeOmContext, isOmContextMismatch } from '@/lib/omContextMatch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SelectionData {
  companyId: string | null;
  companyName: string | null;
  siteId: string | null;
  siteName: string | null;
  projectId: string | null;
  projectName: string | null;
  teamId: string | null;
  teamName: string | null;
  omNumber?: string | null;
  omTitle?: string | null;
}

export default function QuickReportWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  // Context passed from the Reports cabinet ("Novo Relatório" in the current unit)
  const contextFromState = (location.state || null) as
    | { 
        companyId?: string | null; 
        companyName?: string | null; 
        siteId?: string | null; 
        siteName?: string | null;
        omNumber?: string | null;
        omTitle?: string | null;
      }
    | null;
  const { role } = useAuth();
  const { companies, primarySiteId, isLoading: isAccessLoading } = useAdminSiteAccess();

  // Fetch site data for admin to pre-fill the selector
  const { data: adminSiteData, isLoading: isSiteDataLoading } = useQuery({
    queryKey: ['admin-site-data', primarySiteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('sites')
        .select('id, name, company_id, companies(id, name)')
        .eq('id', primarySiteId!)
        .single();
      return data;
    },
    enabled: role === 'admin' && !!primarySiteId,
  });

  const { data: companiesCount, isLoading } = useQuery({
    queryKey: ['has-companies-wizard'],
    queryFn: async () => {
      const { count } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const initialData = useMemo(() => {
    if (contextFromState?.siteId && contextFromState?.companyId) {
      return {
        companyId: contextFromState.companyId,
        companyName: contextFromState.companyName || '',
        siteId: contextFromState.siteId,
        siteName: contextFromState.siteName || '',
        omNumber: contextFromState.omNumber || null,
      };
    }
    if (role === 'admin') {
      if (companies.length > 1) return undefined;
      if (adminSiteData) {
        const company = adminSiteData.companies as any;
        return {
          companyId: company?.id || adminSiteData.company_id,
          companyName: company?.name || '',
          siteId: adminSiteData.id,
          siteName: adminSiteData.name,
        };
      }
    }
    return undefined;
  }, [role, adminSiteData, companies, contextFromState]);

  // Pasta de origem (card clicado em "Meus RDOs")
  const originOm = useMemo(() => {
    if (!contextFromState?.omNumber && !contextFromState?.omTitle) return null;
    return {
      omNumber: contextFromState?.omNumber || null,
      omTitle: contextFromState?.omTitle || null,
    };
  }, [contextFromState?.omNumber, contextFromState?.omTitle]);

  const [pendingSelection, setPendingSelection] = useState<SelectionData | null>(null);

  const goToForm = useCallback((data: SelectionData, keepOrigin: boolean) => {
    navigate(`/reports/create/${data.projectId}`, {
      state: {
        companyId: data.companyId,
        companyName: data.companyName,
        siteId: data.siteId,
        siteName: data.siteName,
        projectId: data.projectId,
        projectName: data.projectName,
        teamId: data.teamId,
        teamName: data.teamName,
        date: (data as any).date,
        omNumber: keepOrigin ? (originOm?.omNumber ?? null) : (data.omNumber ?? null),
        omTitle: keepOrigin ? (originOm?.omTitle ?? null) : (data.omTitle ?? null),
      }
    });
  }, [navigate, originOm]);

  const handleSelectionComplete = useCallback((data: SelectionData) => {
    if (originOm && isOmContextMismatch(originOm, { omNumber: data.omNumber, omTitle: data.omTitle })) {
      setPendingSelection(data);
      return;
    }
    goToForm(data, false);
  }, [originOm, goToForm]);

  if (isLoading || (role === 'admin' && (isAccessLoading || isSiteDataLoading))) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const isAdminRole = role === 'admin' || role === 'super_admin';

  if ((companiesCount ?? 0) === 0 && !isAdminRole) {
    return (
      <EmptyState
        icon={Building2}
        title="Nenhuma fábrica cadastrada"
        description="Peça a um administrador para cadastrar uma fábrica antes de criar relatórios."
      />
    );
  }

  return (
    <>
      <ProjectSelector onComplete={handleSelectionComplete} initialData={initialData} originOm={originOm} />

      <AlertDialog open={!!pendingSelection} onOpenChange={(open) => { if (!open) setPendingSelection(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atividade diferente da pasta de origem</AlertDialogTitle>
            <AlertDialogDescription>
              Você abriu "Novo Relatório" a partir de {describeOmContext(originOm)}, mas selecionou{' '}
              {describeOmContext(
                { omNumber: pendingSelection?.omNumber, omTitle: pendingSelection?.omTitle },
                pendingSelection?.projectName
              )}
              . Onde este RDO deve ser salvo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Voltar e revisar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                const sel = pendingSelection;
                setPendingSelection(null);
                if (sel) goToForm(sel, false);
              }}
            >
              Salvar na atividade selecionada
            </Button>
            <AlertDialogAction
              onClick={() => {
                const sel = pendingSelection;
                setPendingSelection(null);
                if (sel) goToForm(sel, true);
              }}
            >
              Manter pasta de origem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
