import { useNavigate } from 'react-router-dom';
import { FileText, ClipboardList, ArrowRight, Users, FolderKanban, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const cardBase = cn(
  'group relative flex items-center gap-2 sm:gap-4 rounded-xl sm:rounded-2xl border p-3 sm:p-6',
  'transition-all duration-300 ease-out',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  'text-left w-full overflow-hidden',
  'bg-card/80 backdrop-blur-sm border-border/40',
  'hover:bg-card/95 hover:border-border/70 hover:-translate-y-0.5 hover:shadow-md'
);

export function QuickActions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, role } = useAuth();
  const { data: companiesCount } = useQuery({
    queryKey: ['companies-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: draftsCount } = useQuery({
    queryKey: ['drafts-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .eq('status', 'draft');
      return count || 0;
    },
    enabled: !!user?.id,
  });

  const { data: pendingSignaturesCount } = useQuery({
    queryKey: ['pending-signatures-count'],
    queryFn: async () => {
      const { data: sharedAccess } = await supabase
        .from('client_report_access')
        .select('report_id');
      
      if (!sharedAccess || sharedAccess.length === 0) return 0;

      const reportIds = sharedAccess.map(a => a.report_id);
      
      const { data: signatures } = await supabase
        .from('report_signatures')
        .select('report_id')
        .in('report_id', reportIds);

      const signedReportIds = new Set(signatures?.map(s => s.report_id) || []);
      const pendingCount = reportIds.filter(id => !signedReportIds.has(id)).length;
      
      return pendingCount;
    },
  });

  const handleCreateReport = () => {
    navigate('/reports/new');
  };

  return (
    <div className="space-y-4">
      {/* Card Painel Administrativo */}
      {(role === 'super_admin' || role === 'admin') && (
        <button onClick={() => navigate('/super-admin')} className={cardBase}>
          <div className="relative flex h-10 w-10 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-amber-500/15 text-amber-500 transition-all duration-300 group-hover:bg-amber-500 group-hover:text-white group-hover:scale-110">
            <Shield className="h-5 w-5 sm:h-8 sm:w-8" />
          </div>
          <div className="flex-1 space-y-0 sm:space-y-1 min-w-0">
            <h3 className="text-sm sm:text-xl font-bold text-foreground whitespace-normal leading-tight sm:truncate">Painel Administrativo</h3>
            <p className="text-[10px] sm:text-sm text-muted-foreground whitespace-normal leading-tight sm:truncate">
              Gerencie empresas, usuários e sistema
            </p>
          </div>
          <ArrowRight className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground/50 transition-all duration-300 group-hover:translate-x-1 group-hover:text-foreground shrink-0" />
        </button>
      )}

      {/* Card Criar Relatório */}
      <button onClick={handleCreateReport} className={cardBase}>
        <div className="relative flex h-10 w-10 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-primary/15 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110">
          <FileText className="h-5 w-5 sm:h-8 sm:w-8" />
        </div>
        <div className="flex-1 space-y-0 sm:space-y-1 min-w-0">
          <h3 className="text-sm sm:text-xl font-bold text-foreground whitespace-normal leading-tight sm:truncate">Criar Relatório</h3>
          <p className="text-[10px] sm:text-sm text-muted-foreground whitespace-normal leading-tight sm:truncate">
            Registre suas atividades do dia
          </p>
        </div>
        <ArrowRight className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground/50 transition-all duration-300 group-hover:translate-x-1 group-hover:text-foreground shrink-0" />
      </button>

      {/* Card Meus Relatórios */}
      <button onClick={() => navigate('/reports')} className={cardBase}>
        <div className="relative flex h-10 w-10 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-success/15 text-success transition-all duration-300 group-hover:bg-success group-hover:text-success-foreground group-hover:scale-110">
          <ClipboardList className="h-5 w-5 sm:h-8 sm:w-8" />
        </div>
        <div className="flex-1 space-y-0 sm:space-y-1 min-w-0">
          <h3 className="text-sm sm:text-xl font-bold text-foreground whitespace-normal leading-tight sm:truncate">Meus Relatórios</h3>
          <p className="text-[10px] sm:text-sm text-muted-foreground whitespace-normal leading-tight sm:truncate">
            {draftsCount && draftsCount > 0 
              ? `${draftsCount} rascunho${draftsCount > 1 ? 's' : ''} pendente${draftsCount > 1 ? 's' : ''}`
              : 'Veja e gerencie seus relatórios'
            }
          </p>
        </div>
        {draftsCount && draftsCount > 0 && (
          <span className="absolute top-2 sm:top-4 right-8 sm:right-14 flex h-4 sm:h-6 min-w-4 sm:min-w-6 items-center justify-center rounded-full bg-warning px-1 sm:px-2 text-[9px] sm:text-xs font-bold text-warning-foreground">
            {draftsCount}
          </span>
        )}
        <ArrowRight className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground/50 transition-all duration-300 group-hover:translate-x-1 group-hover:text-foreground shrink-0" />
      </button>

      {/* Card Gerenciar Assinaturas */}
      <button onClick={() => navigate('/admin/signatures')} className={cardBase}>
        <div className="relative flex h-10 w-10 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-violet-500/15 text-violet-500 transition-all duration-300 group-hover:bg-violet-500 group-hover:text-white group-hover:scale-110">
          <Users className="h-5 w-5 sm:h-8 sm:w-8" />
        </div>
        <div className="flex-1 space-y-0 sm:space-y-1 min-w-0">
          <h3 className="text-sm sm:text-xl font-bold text-foreground whitespace-normal leading-tight sm:truncate">Gerenciar Assinaturas</h3>
          <p className="text-[10px] sm:text-sm text-muted-foreground whitespace-normal leading-tight sm:truncate">
            {pendingSignaturesCount && pendingSignaturesCount > 0 
              ? `${pendingSignaturesCount} pendente${pendingSignaturesCount > 1 ? 's' : ''} de assinatura`
              : 'Gerencie assinaturas e compartilhamentos'
            }
          </p>
        </div>
        {pendingSignaturesCount && pendingSignaturesCount > 0 && (
          <span className="absolute top-2 sm:top-4 right-8 sm:right-14 flex h-4 sm:h-6 min-w-4 sm:min-w-6 items-center justify-center rounded-full bg-violet-500 px-1 sm:px-2 text-[9px] sm:text-xs font-bold text-white">
            {pendingSignaturesCount}
          </span>
        )}
        <ArrowRight className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground/50 transition-all duration-300 group-hover:translate-x-1 group-hover:text-foreground shrink-0" />
      </button>

      {/* Card Gerenciar Fábricas */}
      {(role === 'super_admin' || role === 'admin') && (
        <button onClick={() => navigate('/reports/new')} className={cardBase}>
          <div className="relative flex h-10 w-10 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-cyan-500/15 text-cyan-500 transition-all duration-300 group-hover:bg-cyan-500 group-hover:text-white group-hover:scale-110">
            <FolderKanban className="h-5 w-5 sm:h-8 sm:w-8" />
          </div>
          <div className="flex-1 space-y-0 sm:space-y-1 min-w-0">
            <h3 className="text-sm sm:text-xl font-bold text-foreground whitespace-normal leading-tight sm:truncate">Gerenciar Fábricas</h3>
            <p className="text-[10px] sm:text-sm text-muted-foreground whitespace-normal leading-tight sm:truncate">
              Fábricas, unidades e atividades
            </p>
          </div>
          <ArrowRight className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground/50 transition-all duration-300 group-hover:translate-x-1 group-hover:text-foreground shrink-0" />
        </button>
      )}
    </div>
  );
}
