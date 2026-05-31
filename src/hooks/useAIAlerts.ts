import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CriticalActivity {
  projectId: string;
  projectName: string;
  siteName: string;
  companyName: string;
  daysSinceLastReport: number;
  riskLevel: string;
  progress: number;
  avgDailyProgress: number;
}

export interface AIAlerts {
  criticalActivities: CriticalActivity[];
  highRiskActivities: CriticalActivity[];
  delayedStartActivities: CriticalActivity[];
  hasAlerts: boolean;
  alertCount: number;
  isLoading: boolean;
  alertsViewed: boolean;
  markAlertsViewed: () => void;
}

export function useAIAlerts(): AIAlerts {
  const { user, isAuthenticated } = useAuth();
  const [criticalActivities, setCriticalActivities] = useState<CriticalActivity[]>([]);
  const [highRiskActivities, setHighRiskActivities] = useState<CriticalActivity[]>([]);
  const [delayedStartActivities, setDelayedStartActivities] = useState<CriticalActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alertsViewed, setAlertsViewed] = useState(false);
  const [lastAlertCount, setLastAlertCount] = useState(0);

  const markAlertsViewed = useCallback(() => {
    setAlertsViewed(true);
  }, []);
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setIsLoading(false);
      return;
    }

    const fetchAlerts = async () => {
      try {
        const { data, error } = await supabase.rpc('get_project_predictions');

        if (error) {
          console.error('Error fetching project predictions:', error);
          return;
        }

        if (!data) return;

        const critical: CriticalActivity[] = [];
        const highRisk: CriticalActivity[] = [];
        const delayedStart: CriticalActivity[] = [];

        data.forEach((project: any) => {
          const activity: CriticalActivity = {
            projectId: project.project_id,
            projectName: project.project_name,
            siteName: project.site_name || 'N/A',
            companyName: project.company_name || 'N/A',
            daysSinceLastReport: project.days_since_last_report,
            riskLevel: project.risk_level,
            progress: project.progress || 0,
            avgDailyProgress: project.avg_daily_progress || 0,
          };

          switch (project.risk_level) {
            case 'crítico':
              critical.push(activity);
              break;
            case 'alto':
              highRisk.push(activity);
              break;
            case 'atrasado_inicio':
              delayedStart.push(activity);
              break;
          }
        });

        setCriticalActivities(critical);
        setHighRiskActivities(highRisk);
        setDelayedStartActivities(delayedStart);
      } catch (error) {
        console.error('Error in useAIAlerts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();

    // Refresh alerts every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, user?.id]);

  const totalAlerts = criticalActivities.length + highRiskActivities.length + delayedStartActivities.length;
  const currentAlertCount = criticalActivities.length + highRiskActivities.length;

  // Reset alertsViewed when new alerts appear
  useEffect(() => {
    if (currentAlertCount > lastAlertCount && lastAlertCount > 0) {
      setAlertsViewed(false);
    }
    setLastAlertCount(currentAlertCount);
  }, [currentAlertCount, lastAlertCount]);

  return {
    criticalActivities,
    highRiskActivities,
    delayedStartActivities,
    hasAlerts: totalAlerts > 0,
    alertCount: currentAlertCount,
    isLoading,
    alertsViewed,
    markAlertsViewed,
  };
}

export function formatAlertsForMessage(alerts: AIAlerts, userName?: string): string | null {
  const { criticalActivities, highRiskActivities, delayedStartActivities } = alerts;
  
  if (criticalActivities.length === 0 && highRiskActivities.length === 0 && delayedStartActivities.length === 0) {
    return null;
  }

  const parts: string[] = [];

  if (criticalActivities.length > 0) {
    parts.push(`\n\n⚠️ **Atenção:** Identifiquei ${criticalActivities.length} atividade(s) em situação **crítica** (sem RDO há 7+ dias):`);
    criticalActivities.slice(0, 3).forEach(a => {
      parts.push(`- **${a.projectName}** (${a.companyName}): ${a.daysSinceLastReport} dias sem registro`);
    });
    if (criticalActivities.length > 3) {
      parts.push(`- ... e mais ${criticalActivities.length - 3} projeto(s)`);
    }
  }

  if (highRiskActivities.length > 0) {
    parts.push(`\n\n🔶 **Alerta:** ${highRiskActivities.length} atividade(s) com risco **alto** (sem RDO há 3-7 dias):`);
    highRiskActivities.slice(0, 2).forEach(a => {
      parts.push(`- **${a.projectName}**: ${a.daysSinceLastReport} dias sem registro`);
    });
    if (highRiskActivities.length > 2) {
      parts.push(`- ... e mais ${highRiskActivities.length - 2} projeto(s)`);
    }
  }

  if (delayedStartActivities.length > 0) {
    parts.push(`\n\n📅 **Atenção:** ${delayedStartActivities.length} projeto(s) com **início atrasado**:`);
    delayedStartActivities.slice(0, 2).forEach(a => {
      parts.push(`- **${a.projectName}**: planejamento deveria ter iniciado`);
    });
  }

  if (parts.length > 0) {
    parts.push('\n\nRecomendo verificar com a equipe de campo. Posso ajudar com mais detalhes?');
  }

  return parts.join('\n');
}
