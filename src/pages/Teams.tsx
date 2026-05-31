import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users2, MoreHorizontal, Pencil, Trash2, Loader2, UserPlus, Eye, Building2, ChevronRight, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState, ConfirmDialog } from '@/components/shared';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Team = Tables<'teams'>;
type Project = Tables<'projects'>;
type Profile = Tables<'profiles'>;
type Company = Tables<'companies'>;

export default function Teams() {
  const { toast } = useToast();
  const { role } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ team_id: string; user_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({ name: '', project_id: '', leader_id: '' });

  const canManageTeams = role === 'super_admin' || role === 'admin';

  const fetchData = async () => {
    try {
      const [teamsRes, projectsRes, companiesRes, profilesRes, membersRes] = await Promise.all([
        supabase.from('teams').select('*').order('name'),
        supabase.from('projects').select('*').order('name'),
        supabase.from('companies').select('*').order('name'),
        supabase.from('profiles').select('*').order('name'),
        supabase.from('team_members').select('team_id, user_id'),
      ]);
      
      if (teamsRes.error) throw teamsRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (membersRes.error) throw membersRes.error;
      
      setTeams(teamsRes.data || []);
      setProjects(projectsRes.data || []);
      setCompanies(companiesRes.data || []);
      setProfiles(profilesRes.data || []);
      setTeamMembers(membersRes.data || []);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reset project filter when company changes
  useEffect(() => {
    setProjectFilter('all');
  }, [companyFilter]);

  const filteredProjects = companyFilter === 'all' 
    ? projects 
    : projects.filter(p => p.company_id === companyFilter);

  const filtered = teams.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
    const project = projects.find(p => p.id === t.project_id);
    const matchesCompany = companyFilter === 'all' || project?.company_id === companyFilter;
    const matchesProject = projectFilter === 'all' || t.project_id === projectFilter;
    return matchesSearch && matchesCompany && matchesProject;
  });

  const getProject = (id: string) => projects.find(p => p.id === id);
  const getProfile = (id: string | null) => profiles.find(p => p.id === id);
  const getMemberCount = (teamId: string) => teamMembers.filter(m => m.team_id === teamId).length;

  const openCreate = () => { 
    setEditingTeam(null); 
    setFormData({ name: '', project_id: '', leader_id: '' }); 
    setIsDialogOpen(true); 
  };

  const openEdit = (team: Team) => { 
    setEditingTeam(team); 
    setFormData({ 
      name: team.name, 
      project_id: team.project_id, 
      leader_id: team.leader_id || '' 
    }); 
    setIsDialogOpen(true); 
  };

  const handleSave = async () => {
    if (!formData.name || !formData.project_id) {
      toast({ title: 'Erro', description: 'Nome e obra são obrigatórios', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      if (editingTeam) {
        const { error } = await supabase
          .from('teams')
          .update({
            name: formData.name,
            project_id: formData.project_id,
            leader_id: formData.leader_id || null,
          })
          .eq('id', editingTeam.id);
        if (error) throw error;
        toast({ title: 'Equipe atualizada' });
      } else {
        const { error } = await supabase
          .from('teams')
          .insert({
            name: formData.name,
            project_id: formData.project_id,
            leader_id: formData.leader_id || null,
          });
        if (error) throw error;
        toast({ title: 'Equipe criada' });
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('teams').delete().eq('id', deleteDialog.id);
      if (error) throw error;
      toast({ title: 'Equipe removida' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
      setDeleteDialog({ open: false, id: null });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 md:pb-0 min-w-0">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList className="flex-wrap">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/companies-manage" className="flex items-center gap-1 text-xs sm:text-sm">
                <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Fábricas</span>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1 text-xs sm:text-sm">
              <Users2 className="h-3 w-3 sm:h-4 sm:w-4" />
              Equipes
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl xs:text-2xl font-bold truncate">Equipes</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} equipe(s)</p>
        </div>
        {canManageTeams && <Button onClick={openCreate} size="sm" className="w-fit"><Plus className="h-4 w-4 mr-1.5" />Nova Equipe</Button>}
      </div>

      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Fábrica" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Obra" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {filteredProjects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users2} title="Nenhuma equipe encontrada" action={canManageTeams ? <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Criar Equipe</Button> : undefined} />
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 xl:grid-cols-3">
          {filtered.map((team) => {
            const project = getProject(team.project_id);
            const leader = getProfile(team.leader_id);
            const memberCount = getMemberCount(team.id);
            return (
              <Card key={team.id} className="card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{team.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <FolderKanban className="h-3.5 w-3.5" />
                        <span>{project?.name || '-'}</span>
                      </div>
                    </div>
                    {canManageTeams && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(team)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteDialog({ open: true, id: team.id })} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {leader && (
                    <div className="flex items-center gap-2 mb-3">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{leader.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">Líder: {leader.name}</span>
                    </div>
                  )}
                  <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Users2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs sm:text-sm text-muted-foreground">{memberCount} membros</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link to={`/teams/${team.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Ver
                        </Button>
                      </Link>
                      {canManageTeams && (
                        <Link to={`/teams/${team.id}`}>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                            <UserPlus className="h-3.5 w-3.5 mr-1" />
                            Montar
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTeam ? 'Editar' : 'Nova'} Equipe</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} /></div>
            <div>
              <Label>Obra *</Label>
              <Select value={formData.project_id} onValueChange={(v) => setFormData(p => ({ ...p, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Líder</Label>
              <Select value={formData.leader_id} onValueChange={(v) => setFormData(p => ({ ...p, leader_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => {
          if (!open) setDeleteDialog({ open: false, id: null });
        }} 
        title="Excluir equipe?" 
        description={`Tem certeza que deseja excluir a equipe "${teams.find(t => t.id === deleteDialog.id)?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir" 
        variant="destructive" 
        onConfirm={handleDelete} 
      />
    </div>
  );
}
