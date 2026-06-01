import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminSiteAccess } from '@/hooks/useAdminSiteAccess';
import { ProjectSelector } from '@/components/reports/ProjectSelector';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2 } from 'lucide-react';

interface SelectionData {
  companyId: string | null;
  companyName: string | null;
  siteId: string | null;
  siteName: string | null;
  projectId: string | null;
  projectName: string | null;
  teamId: string | null;
  teamName: string | null;
}

export default function QuickReportWizard() {
  const navigate = useNavigate();
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
  }, [role, adminSiteData, companies]);

  const handleSelectionComplete = useCallback((data: SelectionData) => {
    // Navigate to simplified report form with selection data
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
      }
    });
  }, [navigate]);

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

  return <ProjectSelector onComplete={handleSelectionComplete} initialData={initialData} />;
}
