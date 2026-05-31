import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EntityCounts {
  sites: number;
  projects: number;
  teams: number;
}

export function useEntityCounts() {
  const { data, isLoading } = useQuery({
    queryKey: ['entity-counts'],
    queryFn: async (): Promise<EntityCounts> => {
      const [sitesRes, projectsRes, teamsRes] = await Promise.all([
        supabase.from('sites').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('teams').select('id', { count: 'exact', head: true }),
      ]);
      
      return {
        sites: sitesRes.count || 0,
        projects: projectsRes.count || 0,
        teams: teamsRes.count || 0,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    counts: data || { sites: 0, projects: 0, teams: 0 },
    isLoading,
  };
}
