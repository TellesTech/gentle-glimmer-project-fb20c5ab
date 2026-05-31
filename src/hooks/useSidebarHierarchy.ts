import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface HierarchyCompany {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface SidebarHierarchy {
  companies: HierarchyCompany[];
  totalCompanies: number;
}

export function useSidebarHierarchy() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['sidebar-hierarchy', user?.id],
    queryFn: async (): Promise<SidebarHierarchy> => {
      if (!user) {
        return { companies: [], totalCompanies: 0 };
      }

      // Buscar apenas empresas (limitado a 5 para performance)
      const { data: companies, error: companiesError, count } = await supabase
        .from('companies')
        .select('id, name, logo_url', { count: 'exact' })
        .order('name')
        .limit(5);

      if (companiesError) {
        console.error('Error fetching companies:', companiesError);
        return { companies: [], totalCompanies: 0 };
      }

      return {
        companies: companies || [],
        totalCompanies: count || companies?.length || 0,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchOnWindowFocus: false,
  });

  return {
    hierarchy: query.data || { companies: [], totalCompanies: 0 },
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
