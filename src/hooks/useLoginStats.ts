import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LoginStats {
  totalReports: number;
  totalProjects: number;
  totalCompaniesSites: number;
}

export function useLoginStats() {
  return useQuery({
    queryKey: ['login-stats'],
    queryFn: async (): Promise<LoginStats> => {
      try {
        const { data, error } = await (supabase as any).rpc('get_login_stats');
        
        if (error) {
          console.warn('Estatísticas indisponíveis:', error.message);
          return { totalReports: 0, totalProjects: 0, totalCompaniesSites: 0 };
        }
        
        const stats = data as { totalReports?: number; totalProjects?: number; totalCompaniesSites?: number } | null;
        
        return {
          totalReports: stats?.totalReports || 0,
          totalProjects: stats?.totalProjects || 0,
          totalCompaniesSites: stats?.totalCompaniesSites || 0,
        };
      } catch {
        console.warn('Falha de rede ao buscar estatísticas');
        return { totalReports: 0, totalProjects: 0, totalCompaniesSites: 0 };
      }
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
}
