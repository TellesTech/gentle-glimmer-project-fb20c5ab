import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Plus, FileText, Building2, MapPin, Calendar, Edit, Trash2, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AIReportGeneratorDialog } from '@/components/service-reports/AIReportGeneratorDialog';

export default function ServiceReportBuilder() {
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // Fetch sites for filter — restricted to units the user has access to
  // (portal_admin_access + site_responsibles). Super_admin sees all.
  const { data: sites, isLoading: sitesLoading } = useQuery({
    queryKey: ['sites-for-service-reports', user?.id, role, profile?.company_id],
    queryFn: async () => {
      const isSuper = role === 'super_admin';
      if (isSuper) {
        const query = supabase.from('sites').select('id, name, city, state, company_id').order('name');
        if (profile?.company_id) query.eq('company_id', profile.company_id);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      }

      const [paaRes, srRes] = await Promise.all([
        supabase.from('portal_admin_access').select('site_id').eq('user_id', user!.id),
        supabase.from('site_responsibles').select('site_id').eq('user_id', user!.id),
      ]);
      const allowedIds = Array.from(new Set([
        ...((paaRes.data || []).map((r: any) => r.site_id as string)),
        ...((srRes.data || []).map((r: any) => r.site_id as string)),
      ]));
      if (allowedIds.length === 0) return [];

      const { data, error } = await supabase
        .from('sites')
        .select('id, name, city, state, company_id')
        .in('id', allowedIds)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch service reports
  const { data: reports, isLoading: reportsLoading, refetch } = useQuery({
    queryKey: ['service-reports', selectedSiteId, profile?.company_id],
    queryFn: async () => {
      let query = supabase
        .from('service_reports')
        .select('*, sites(name, city, state), projects(name)')
        .order('updated_at', { ascending: false });

      if (selectedSiteId !== 'all') {
        query = query.eq('site_id', selectedSiteId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('service_reports').delete().eq('id', deleteId);
    if (error) {
      toast.error('Erro ao excluir relatório');
    } else {
      toast.success('Relatório excluído');
      refetch();
    }
    setDeleteId(null);
  };

  const [showNewReportChoice, setShowNewReportChoice] = useState(false);

  const handleNewReport = () => {
    setShowNewReportChoice(true);
  };

  const handleCreateBlank = async () => {
    setShowNewReportChoice(false);
    const siteId = selectedSiteId !== 'all' ? selectedSiteId : sites?.[0]?.id;
    // Resolve company_id from the selected site so users without a profile
    // company_id (e.g. portal admins) can still create reports under their
    // authorized unit (RLS uses site/project access).
    const selectedSite = sites?.find((s: any) => s.id === siteId);
    const resolvedCompanyId = (selectedSite as any)?.company_id || profile?.company_id || null;

    const { data, error } = await supabase
      .from('service_reports')
      .insert({
        title: 'Novo Relatório de Serviço',
        company_id: resolvedCompanyId,
        site_id: siteId || null,
        created_by: user!.id,
      })
      .select('id')
      .single();

    if (error) {
      toast.error('Erro ao criar relatório: ' + (error.message || ''));
      return;
    }

    const defaultSections = [
      { report_id: data.id, title: 'Escopo dos Serviços', section_type: 'scope' as const, order_index: 0, content: [] },
      { report_id: data.id, title: 'Segurança', section_type: 'safety' as const, order_index: 1, content: [] },
      { report_id: data.id, title: 'Execução', section_type: 'execution' as const, order_index: 2, content: [] },
      { report_id: data.id, title: 'Conclusão e Recomendações', section_type: 'conclusion' as const, order_index: 3, content: [] },
    ];

    await supabase.from('service_report_sections').insert(defaultSections);
    navigate(`/service-reports/${data.id}/edit`);
  };

  const handleCreateWithAI = () => {
    setShowNewReportChoice(false);
    setAiDialogOpen(true);
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground border-border',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    published: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    completed: 'Concluído',
    published: 'Publicado',
  };

  const isLoading = sitesLoading || reportsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Construtor de Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crie e gerencie relatórios de serviço por unidade
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAiDialogOpen(true)} className="gap-2">
            <Sparkles className="w-4 h-4" />
            Gerar com IA
          </Button>
          <Button onClick={handleNewReport} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Relatório
          </Button>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Filtrar por unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {sites?.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name} {site.city ? `- ${site.city}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reports list */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : reports && reports.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report: any) => (
            <Card
              key={report.id}
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(`/service-reports/${report.id}/edit`)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm line-clamp-2">{(report as any).projects?.name || report.title?.replace(/^Relatório - .+ - /, '') || report.title}</CardTitle>
                  <Badge className={statusColors[report.status] || ''} variant="secondary">
                    {statusLabels[report.status] || report.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-1">
                {report.sites && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{(report.sites as any).name}</span>
                  </div>
                )}
                {report.client_name && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{report.client_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{format(new Date(report.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </div>

                <div className="flex justify-end gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/service-reports/${report.id}/edit`);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(report.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="Nenhum relatório de serviço"
          description="Crie seu primeiro relatório de serviço para começar"
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir relatório"
        description="Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
        variant="destructive"
      />

      <Dialog open={showNewReportChoice} onOpenChange={setShowNewReportChoice}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Relatório de Serviço</DialogTitle>
            <DialogDescription>
              Escolha como deseja criar o relatório
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={handleCreateWithAI}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Gerar com IA</p>
                  <p className="text-xs text-muted-foreground">A IA analisa os RDOs e gera um relatório completo automaticamente</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={handleCreateBlank}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Criar em branco</p>
                  <p className="text-xs text-muted-foreground">Começar com um template vazio para preencher manualmente</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <AIReportGeneratorDialog open={aiDialogOpen} onOpenChange={setAiDialogOpen} />
    </div>
  );
}
