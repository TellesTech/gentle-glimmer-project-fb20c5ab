import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { SuperAdminCharts } from '@/components/admin/SuperAdminCharts';
import { Progress } from '@/components/ui/progress';
import { ValidatedInput } from '@/components/shared/ValidatedInput';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { 
  Crown, Plus, Search, Edit, Trash2, Users, Loader2, Building2, 
  FileText, UserPlus,
  PenTool, CheckCircle2, AlertCircle, Pencil, HardDrive
} from 'lucide-react';

// =============== TYPES ===============
interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
}

interface UserWithDetails {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar_url: string | null;
  company_id: string | null;
  company_name: string | null;
  role: UserRole | null;
  created_at: string | null;
}

interface Stats {
  totalCompanies: number;
  totalUsers: number;
  totalReports: number;
  totalSites: number;
  totalProjects: number;
  totalTeams: number;
  reportsToday: number;
  reportsThisWeek: number;
  // Report status breakdown
  reportsDraft: number;
  reportsCompleted: number;
  reportsSent: number;
  reportsSigned: number;
  // Signature stats
  totalSignatures: number;
  signedSignatures: number;
  pendingSignatures: number;
  cancelledSignatures: number;
}

interface RecentReport {
  id: string;
  date: string;
  project_name: string;
  company_name: string;
  created_at: string;
}

interface RecentUser {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  created_at: string;
}

// Hub Card Data
interface CompanyHubCard {
  id: string;
  name: string;
  cnpj: string | null;
  logo_url: string | null;
  photo_url: string | null;
  totalSites: number;
  totalProjects: number;
  totalRdos: number;
  rdosDraft: number;
  rdosCompleted: number;
  rdosSent: number;
  rdosSigned: number;
  totalSignatures: number;
  signedSignatures: number;
  pendingSignatures: number;
  lastRdoDate: string | null;
  totalCollaborators: number;
}

// =============== CONSTANTS ===============
const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  collaborator: 'Operacional',
};

const roleColors: Record<string, string> = {
  super_admin: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
  admin: 'bg-primary text-primary-foreground',
  collaborator: 'bg-muted text-muted-foreground',
};

const allRoles: UserRole[] = ['super_admin', 'admin', 'collaborator'];

// =============== MAIN COMPONENT ===============
export default function SuperAdminPanel() {
  const { role: currentUserRole } = useAuth();

  // Admin regular não pode acessar o painel completo
  if (currentUserRole === 'admin') {
    return <Navigate to="/home" replace />;
  }

  if (currentUserRole !== 'super_admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Acesso restrito a Administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 md:pb-0 min-w-0">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
      <OverviewTab />
    </div>
  );
}

// =============== OVERVIEW TAB ===============
function OverviewTab() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalCompanies: 0,
    totalUsers: 0,
    totalReports: 0,
    totalSites: 0,
    totalProjects: 0,
    totalTeams: 0,
    reportsToday: 0,
    reportsThisWeek: 0,
    reportsDraft: 0,
    reportsCompleted: 0,
    reportsSent: 0,
    reportsSigned: 0,
    totalSignatures: 0,
    signedSignatures: 0,
    pendingSignatures: 0,
    cancelledSignatures: 0,
  });
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [companyCards, setCompanyCards] = useState<CompanyHubCard[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Edit/Delete state for hub cards
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyHubCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', cnpj: '' });

  const handleEditCompany = (company: CompanyHubCard) => {
    setSelectedCompany(company);
    setEditForm({ name: company.name, cnpj: company.cnpj || '' });
    setEditDialogOpen(true);
  };

  const handleSaveCompany = async () => {
    if (!selectedCompany || !editForm.name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ name: editForm.name, cnpj: editForm.cnpj || null })
        .eq('id', selectedCompany.id);
      if (error) throw error;
      toast({ title: 'Fábrica atualizada com sucesso' });
      setEditDialogOpen(false);
      fetchStats();
    } catch (error) {
      console.error('Error saving company:', error);
      toast({ title: 'Erro ao salvar fábrica', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', selectedCompany.id);
      if (error) throw error;
      toast({ title: 'Fábrica removida com sucesso' });
      setDeleteDialogOpen(false);
      setSelectedCompany(null);
      fetchStats();
    } catch (error) {
      console.error('Error deleting company:', error);
      toast({ title: 'Erro ao remover fábrica. Verifique se não há dados vinculados.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString();

      const [
        { count: companiesCount },
        { count: usersCount },
        { count: reportsCount },
        { count: sitesCount },
        { count: projectsCount },
        { count: teamsCount },
        { count: reportsTodayCount },
        { count: reportsWeekCount },
        { data: reportsWithProjects },
        { data: recentProfilesData },
        { data: companiesData },
        // Reports by status
        { count: reportsDraftCount },
        { count: reportsCompletedCount },
        { count: reportsSentCount },
        { count: reportsSignedCount },
        // Autentique signatures
        { data: signaturesData },
        // Signatures per company
        { data: signaturesPerCompanyData },
      ] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }),
        supabase.from('sites').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('teams').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
        supabase.from('reports').select('*', { count: 'exact', head: true }).gte('created_at', weekAgoStr),
        supabase.from('reports').select('id, date, created_at, project_id, projects(name, company_id, companies(name))').order('created_at', { ascending: false }).limit(5),
        supabase.from('profiles').select('id, name, email, created_at, company_id, companies(name)').order('created_at', { ascending: false }).limit(5),
        // Query para cards de empresas com contagem de RDOs e status
        supabase.from('companies').select(`
          id, name, cnpj, logo_url, photo_url,
          sites (
            id,
            projects (
              id, status,
              reports (id, date, status),
              teams (
                id,
                team_members (id)
              )
            )
          )
        `).order('name'),
        // Reports by status
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'signed'),
        // Native approvers (substitui Autentique)
        supabase.from('report_company_approvers').select('id, status, report_id'),
        // Approvers per company (via reports -> projects -> sites -> companies)
        supabase.from('report_company_approvers').select(`
          id, status,
          reports!inner (
            project_id,
            projects!inner (
              site_id,
              sites!inner (
                company_id
              )
            )
          )
        `),
      ]);

      // Calculate signature stats (approvers nativos)
      const allSignatures = signaturesData || [];
      const signedCount = allSignatures.filter((s: any) => s.status === 'approved').length;
      const pendingCount = allSignatures.filter((s: any) => s.status === 'pending').length;
      const cancelledCount = allSignatures.filter((s: any) => s.status === 'rejected').length;

      // Calculate pending signatures per company
      const pendingPerCompany: Record<string, number> = {};
      (signaturesPerCompanyData || []).forEach((doc: any) => {
        if (doc.status === 'pending') {
          const companyId = doc.reports?.projects?.sites?.company_id;
          if (companyId) {
            pendingPerCompany[companyId] = (pendingPerCompany[companyId] || 0) + 1;
          }
        }
      });

      setStats({
        totalCompanies: companiesCount || 0,
        totalUsers: usersCount || 0,
        totalReports: reportsCount || 0,
        totalSites: sitesCount || 0,
        totalProjects: projectsCount || 0,
        totalTeams: teamsCount || 0,
        reportsToday: reportsTodayCount || 0,
        reportsThisWeek: reportsWeekCount || 0,
        reportsDraft: reportsDraftCount || 0,
        reportsCompleted: reportsCompletedCount || 0,
        reportsSent: reportsSentCount || 0,
        reportsSigned: reportsSignedCount || 0,
        totalSignatures: allSignatures.length,
        signedSignatures: signedCount,
        pendingSignatures: pendingCount,
        cancelledSignatures: cancelledCount,
      });

      // Process recent reports
      const processedReports: RecentReport[] = (reportsWithProjects || []).map((r: any) => ({
        id: r.id,
        date: r.date,
        project_name: r.projects?.name || 'Projeto desconhecido',
        company_name: r.projects?.companies?.name || 'Empresa desconhecida',
        created_at: r.created_at,
      }));
      setRecentReports(processedReports);

      // Process recent users
      const processedUsers: RecentUser[] = (recentProfilesData || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        company_name: u.companies?.name || null,
        created_at: u.created_at,
      }));
      setRecentUsers(processedUsers);

      // Calculate signatures per company (all statuses)
      const signaturesPerCompanyMap: Record<string, { total: number; signed: number; pending: number }> = {};
      (signaturesPerCompanyData || []).forEach((doc: any) => {
        const companyId = doc.reports?.projects?.sites?.company_id;
        if (companyId) {
          if (!signaturesPerCompanyMap[companyId]) {
            signaturesPerCompanyMap[companyId] = { total: 0, signed: 0, pending: 0 };
          }
          signaturesPerCompanyMap[companyId].total++;
          if (doc.status === 'signed') {
            signaturesPerCompanyMap[companyId].signed++;
          } else if (doc.status === 'pending' || doc.status === 'created') {
            signaturesPerCompanyMap[companyId].pending++;
          }
        }
      });

      // Process company cards
      const processedCards: CompanyHubCard[] = (companiesData || []).map((company: any) => {
        const allProjects: any[] = [];
        const allReports: any[] = [];
        const allReportDates: string[] = [];
        const totalSites = (company.sites || []).length;
        let totalCollaborators = 0;
        
        (company.sites || []).forEach((site: any) => {
          (site.projects || []).forEach((project: any) => {
            allProjects.push(project);
            const projectReports = project.reports || [];
            allReports.push(...projectReports);
            projectReports.forEach((report: any) => {
              if (report.date) allReportDates.push(report.date);
            });
            // Count collaborators (team members)
            (project.teams || []).forEach((team: any) => {
              totalCollaborators += (team.team_members || []).length;
            });
          });
        });
        
        const lastRdoDate = allReportDates.length > 0 
          ? allReportDates.sort().reverse()[0] 
          : null;

        const companySignatures = signaturesPerCompanyMap[company.id] || { total: 0, signed: 0, pending: 0 };
        
        return {
          id: company.id,
          name: company.name,
          cnpj: company.cnpj,
          logo_url: company.logo_url,
          photo_url: company.photo_url,
          totalSites,
          totalProjects: allProjects.length,
          totalRdos: allReports.length,
          rdosDraft: allReports.filter(r => r.status === 'draft').length,
          rdosCompleted: allReports.filter(r => r.status === 'completed').length,
          rdosSent: allReports.filter(r => r.status === 'sent').length,
          rdosSigned: allReports.filter(r => r.status === 'signed').length,
          totalSignatures: companySignatures.total,
          signedSignatures: companySignatures.signed,
          pendingSignatures: companySignatures.pending,
          lastRdoDate,
          totalCollaborators,
        };
      });
      setCompanyCards(processedCards);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Company Hub Card - redesigned to match ProjectSelector style
  const CompanyHubCardComponent = ({ company }: { company: CompanyHubCard }) => {
    return (
      <Card 
        className="cursor-pointer transition-all sm:hover:shadow-xl sm:hover:scale-[1.02] active:scale-[0.99] group h-full relative overflow-hidden"
        onClick={() => navigate(`/companies/${company.id}/dashboard`)}
      >
        {/* Badge top-left */}
        <Badge variant="secondary" className="absolute top-2 left-2 z-10 text-[10px] px-2 py-0.5">
          Fábrica
        </Badge>

        {/* Action buttons top-right */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm"
            onClick={(e) => { e.stopPropagation(); handleEditCompany(company); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-destructive/90 hover:text-destructive-foreground shadow-sm"
            onClick={(e) => { e.stopPropagation(); setSelectedCompany(company); setDeleteDialogOpen(true); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Image area */}
        <div className="aspect-[2/1] flex items-center justify-center bg-muted/30 p-4">
          {(company.logo_url || company.photo_url) ? (
            <img 
              src={company.logo_url || company.photo_url!} 
              alt={company.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
          )}
        </div>

        {/* Name */}
        <div className="p-3 pt-2">
          <button className="w-full py-2 px-3 rounded-lg bg-white/80 backdrop-blur-xl border border-gray-200 shadow-md text-sm font-semibold text-gray-800 hover:bg-white/90 hover:shadow-lg transition-all">
            Dashboard {company.name}
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Company Hub Cards */}
      <div className="space-y-4">
        
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="p-6">
                <div className="flex flex-col items-center">
                  <Skeleton className="h-20 w-20 rounded-2xl mb-4" />
                  <Skeleton className="h-6 w-32 mb-3" />
                  <Skeleton className="h-5 w-24 mb-3" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : companyCards.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma fábrica cadastrada</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {companyCards.map((company) => (
              <CompanyHubCardComponent key={company.id} company={company} />
            ))}
            {/* Nova Fábrica card */}
            <Card
              className="cursor-pointer border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-all hover:shadow-md flex items-center justify-center min-h-[160px]"
              onClick={() => navigate('/companies-manage')}
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Plus className="h-8 w-8" />
                <span className="text-sm font-medium">Nova Fábrica</span>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Atalhos administrativos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card
          className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
          onClick={() => navigate('/admin/backup')}
        >
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="rounded-lg bg-primary/10 p-2">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Backup do Sistema</CardTitle>
              <CardDescription className="text-xs">Exportar, agendar e importar backup completo (.zip)</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Edit Company Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Fábrica</DialogTitle>
            <DialogDescription>Atualize os dados da fábrica</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome da fábrica"
              />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input
                value={editForm.cnpj}
                onChange={(e) => setEditForm(f => ({ ...f, cnpj: e.target.value }))}
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCompany} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Company Confirm */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Confirmar exclusão"
        description={`Tem certeza que deseja excluir a fábrica "${selectedCompany?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="destructive"
        onConfirm={handleDeleteCompany}
      />
    </div>
  );
}

// =============== COMPANIES TAB ===============
function CompaniesTab() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    email: '',
    phone: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (company?: Company) => {
    if (company) {
      setSelectedCompany(company);
      setFormData({
        name: company.name,
        cnpj: company.cnpj || '',
        email: company.email || '',
        phone: company.phone || '',
        city: company.city || '',
        state: company.state || '',
      });
    } else {
      setSelectedCompany(null);
      setFormData({ name: '', cnpj: '', email: '', phone: '', city: '', state: '' });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (selectedCompany) {
        const { error } = await supabase
          .from('companies')
          .update({
            name: formData.name,
            cnpj: formData.cnpj || null,
            email: formData.email || null,
            phone: formData.phone || null,
            city: formData.city || null,
            state: formData.state || null,
          })
          .eq('id', selectedCompany.id);

        if (error) throw error;
        toast({ title: 'Fábrica atualizada com sucesso' });
      } else {
        const { error } = await supabase
          .from('companies')
          .insert({
            name: formData.name,
            cnpj: formData.cnpj || null,
            email: formData.email || null,
            phone: formData.phone || null,
            city: formData.city || null,
            state: formData.state || null,
          });

        if (error) throw error;
        toast({ title: 'Fábrica criada com sucesso' });
      }

      setDialogOpen(false);
      fetchCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
      toast({ title: 'Erro ao salvar fábrica', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany) return;

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', selectedCompany.id);

      if (error) throw error;
      toast({ title: 'Fábrica removida com sucesso' });
      setDeleteDialogOpen(false);
      setSelectedCompany(null);
      fetchCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
      toast({ title: 'Erro ao remover fábrica', variant: 'destructive' });
    }
  };

  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return companies;
    const term = search.toLowerCase();
    return companies.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.cnpj?.includes(term)
    );
  }, [companies, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fábrica..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Fábrica
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredCompanies.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma fábrica encontrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">CNPJ</TableHead>
                  <TableHead className="hidden md:table-cell">Cidade/Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Criado em</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{company.name}</p>
                        <p className="text-sm text-muted-foreground">{company.email || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{company.cnpj || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {company.city && company.state ? `${company.city}, ${company.state}` : '-'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {new Date(company.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(company)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            setSelectedCompany(company);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCompany ? 'Editar Fábrica' : 'Nova Fábrica'}</DialogTitle>
            <DialogDescription>
              {selectedCompany ? 'Atualize os dados da fábrica' : 'Cadastre uma nova fábrica'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome da fábrica"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <ValidatedInput
                  id="company-cnpj"
                  label="CNPJ"
                  type="cnpj"
                  value={formData.cnpj}
                  onChange={(value) => setFormData(f => ({ ...f, cnpj: value }))}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@fabrica.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cidade</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData(f => ({ ...f, city: e.target.value }))}
                  placeholder="Cidade"
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData(f => ({ ...f, state: e.target.value }))}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a fábrica "{selectedCompany?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============== USERS TAB ===============
function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    role: '' as UserRole | '',
    company_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [
        { data: profilesData },
        { data: rolesData },
        { data: companiesData },
      ] = await Promise.all([
        supabase.from('profiles').select('*, companies(name)').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('companies').select('*').order('name'),
      ]);

      const rolesMap = new Map<string, UserRole>();
      rolesData?.forEach(r => {
        if (!rolesMap.has(r.user_id) || r.role === 'super_admin') {
          rolesMap.set(r.user_id, r.role as UserRole);
        }
      });

      const usersWithDetails: UserWithDetails[] = (profilesData || []).map((p: any) => ({
        id: p.id,
        email: p.email,
        name: p.name,
        phone: p.phone,
        avatar_url: p.avatar_url,
        company_id: p.company_id,
        company_name: p.companies?.name || null,
        role: rolesMap.get(p.id) || null,
        created_at: p.created_at,
      }));

      setUsers(usersWithDetails);
      setCompanies(companiesData || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user: UserWithDetails) => {
    setSelectedUser(user);
    setFormData({
      role: user.role || '',
      company_id: user.company_id || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      // Update role
      if (formData.role) {
        await supabase.from('user_roles').delete().eq('user_id', selectedUser.id);
        await supabase.from('user_roles').insert({ user_id: selectedUser.id, role: formData.role });
      }

      // Update company
      await supabase
        .from('profiles')
        .update({ company_id: formData.company_id || null })
        .eq('id', selectedUser.id);

      toast({ title: 'Usuário atualizado com sucesso' });
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({ title: 'Erro ao atualizar usuário', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = !search.trim() ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesCompany = companyFilter === 'all' || u.company_id === companyFilter;
      return matchesSearch && matchesRole && matchesCompany;
    });
  }, [users, search, roleFilter, companyFilter]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por papel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os papéis</SelectItem>
            {allRoles.map(role => (
              <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por fábrica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fábricas</SelectItem>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum usuário encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead className="hidden md:table-cell">Fábrica</TableHead>
                  <TableHead className="hidden md:table-cell">Criado em</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.role ? (
                        <Badge className={cn('text-xs', roleColors[user.role])}>
                          {roleLabels[user.role]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {user.company_name || '-'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize o papel e empresa do usuário {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Papel</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData(f => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um papel" />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map(role => (
                    <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fábrica</Label>
              <Select value={formData.company_id} onValueChange={(v) => setFormData(f => ({ ...f, company_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma fábrica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}