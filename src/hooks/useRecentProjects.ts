import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'recent-projects';
const MAX_RECENT_PROJECTS = 5;

export interface RecentProject {
  id: string;
  name: string;
  code: string | null;
  company_name: string | null;
  site_name: string | null;
}

export function useRecentProjects() {
  const { user } = useAuth();
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${user.id}`);
      if (stored) {
        try {
          setRecentIds(JSON.parse(stored));
        } catch (e) {
          console.error('Error parsing recent projects:', e);
        }
      }
    }
  }, [user]);

  // Save to localStorage when recentIds change
  useEffect(() => {
    if (user && recentIds.length > 0) {
      localStorage.setItem(`${STORAGE_KEY}-${user.id}`, JSON.stringify(recentIds));
    }
  }, [recentIds, user]);

  // Track project access
  const trackProjectAccess = useCallback((projectId: string) => {
    setRecentIds((prev) => {
      // Remove if already exists, then add to beginning
      const filtered = prev.filter((id) => id !== projectId);
      const updated = [projectId, ...filtered].slice(0, MAX_RECENT_PROJECTS);
      return updated;
    });
  }, []);

  // Fetch project details from Supabase
  const { data: recentProjects = [], isLoading } = useQuery({
    queryKey: ['recent-projects', recentIds],
    queryFn: async () => {
      if (recentIds.length === 0) return [];

      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          code,
          sites(name),
          companies(name)
        `)
        .in('id', recentIds);

      if (error) {
        console.error('Error fetching recent projects:', error);
        return [];
      }

      // Sort by the order in recentIds and map to RecentProject format
      return recentIds
        .map((id) => {
          const project = data?.find((p) => p.id === id);
          if (!project) return null;
          return {
            id: project.id,
            name: project.name,
            code: project.code,
            company_name: (project.companies as any)?.name || null,
            site_name: (project.sites as any)?.name || null,
          } as RecentProject;
        })
        .filter(Boolean) as RecentProject[];
    },
    enabled: recentIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    recentProjects,
    trackProjectAccess,
    isLoading,
  };
}
