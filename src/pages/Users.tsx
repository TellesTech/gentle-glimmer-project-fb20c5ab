import { useState, useEffect } from 'react';
import { Plus, Search, UserCog, MoreHorizontal, Pencil, Trash2, Key, Loader2, Wrench, UserX, Eye, EyeOff, Mail, Download, Upload, MapPin, AlertTriangle, CheckSquare, X, KeyRound, Lock, LockOpen, Factory } from 'lucide-react';
import { SiteAccessSelector } from '@/components/users/SiteAccessSelector';
import { exportUsersToCSV } from '@/lib/adminExports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState, ConfirmDialog, RoleBadge, AvatarUpload } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { ImportCollaboratorsDialog } from '@/components/users/ImportCollaboratorsDialog';
import { FunctionSelect } from '@/components/shared/FunctionSelect';
import { Checkbox } from '@/components/ui/checkbox';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/loose-client';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

const translateAuthError = (msg: string): string => {
  const map: Record<string, string> = {
    'A user with this email address has already been registered': 'Já existe um usuário cadastrado com este email',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
    'Unable to validate email address: invalid format': 'Formato de email inválido',
    'User already registered': 'Já existe um usuário cadastrado com este email',
  };
  return map[msg] || msg;
};

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  company_id: string | null;
  created_at: string;
  role: UserRole;
  job_title: string | null;
  state: string | null;
  employment_type?: 'fixo' | 'intermitente' | null;
  has_pin?: boolean;
}

export default function UsersPage() {
  const { toast } = useToast();
  const { role, user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  
  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [batchSelectDeleteDialog, setBatchSelectDeleteDialog] = useState(false);
  const [batchSelectDeleting, setBatchSelectDeleting] = useState(false);
  
  // Dialogs
  const [isCreateEditOpen, setIsCreateEditOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [pinDialog, setPinDialog] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [removePinDialog, setRemovePinDialog] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [pinInput, setPinInput] = useState('');
  // Form states
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '',
    role: 'collaborator' as UserRole, 
    job_title: '',
    password: '',
    avatar_url: '' as string | null,
    state: '',
    employment_type: 'fixo' as 'fixo' | 'intermitente'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ userId: '', userName: '', newPassword: '', confirmPassword: '' });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Site access (super admin only)
  const [assignedSiteIds, setAssignedSiteIds] = useState<Set<string>>(new Set());
  const [siteCounts, setSiteCounts] = useState<Record<string, number>>({});

  const canManageUsers = role === 'super_admin' || role === 'admin';

  // Fetch users from Edge Function
  const fetchUsers = async () => {
    if (!canManageUsers) {
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await (supabase as any).auth.getSession();
      if (!session) {
        toast({ title: 'Sessão expirada', variant: 'destructive' });
        return;
      }

      const response = await supabase.functions.invoke('admin-users', {
        body: { action: 'list' },
      });

      if (response.error) {
        console.error('Fetch users error:', response.error);
        toast({ title: 'Erro ao carregar usuários', description: response.error.message, variant: 'destructive' });
        return;
      }

      setUsers(response.data.users || []);

      // Fetch site counts (server-side validates super admin access)
      try {
        const countsResp = await supabase.functions.invoke('admin-users', { body: { action: 'list-all-user-site-counts' } });
        if (countsResp.data?.counts) setSiteCounts(countsResp.data.counts);
      } catch (e) { console.warn('Failed to load site counts', e); }
    } catch (error) {
      console.error('Fetch users error:', error);
      toast({ title: 'Erro ao carregar usuários', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [canManageUsers]);

  const filtered = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (u.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesState = stateFilter === 'all' || u.state === stateFilter;
    return matchesSearch && matchesRole && matchesState;
  });

  // Count only record-only collaborators (@internal.local)
  const recordOnlyCount = users.filter(
    u => u.role === 'collaborator' && u.email?.includes('@internal.local')
  ).length;

  const branchOptions = [
    { value: 'joao-neiva-es', label: 'Espírito Santo' },
    { value: 'pecem-ce', label: 'Ceará' }
  ];

  const getBranchName = (state: string | null) => {
    if (!state) return null;
    const branch = branchOptions.find(b => b.value === state);
    return branch?.label || state;
  };

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', role: 'collaborator', job_title: '', password: '', avatar_url: null, state: '', employment_type: 'fixo' });
    setShowPassword(false);
    setAssignedSiteIds(new Set());
    setIsCreateEditOpen(true);
  };

  const openEdit = async (userToEdit: AdminUser) => {
    setEditingUser(userToEdit);
    setFormData({ 
      name: userToEdit.name, 
      email: userToEdit.email,
      role: userToEdit.role,
      job_title: userToEdit.job_title || '',
      password: '',
      avatar_url: userToEdit.avatar_url,
      state: userToEdit.state || '',
      employment_type: (userToEdit.employment_type === 'intermitente' ? 'intermitente' : 'fixo')
    });
    setShowPassword(false);
    setAssignedSiteIds(new Set());
    setIsCreateEditOpen(true);

    // Load site assignments (backend validates super_admin permission)
    if (userToEdit.role !== 'super_admin') {
      try {
        const resp = await supabase.functions.invoke('admin-users', {
          body: { action: 'list-user-sites', userId: userToEdit.id }
        });
        if (resp.data?.siteIds) setAssignedSiteIds(new Set(resp.data.siteIds));
      } catch (e) { console.warn('Failed to load user sites', e); }
    }
  };

  const openPasswordReset = (userToReset: AdminUser) => {
    setPasswordData({ 
      userId: userToReset.id, 
      userName: userToReset.name, 
      newPassword: '', 
      confirmPassword: '' 
    });
    setIsPasswordOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    // Email e senha são obrigatórios para usuários com acesso ao sistema (não colaboradores)
    if (!editingUser && formData.role !== 'collaborator') {
      if (!formData.email.trim()) {
        toast({ title: 'Email é obrigatório para usuários com acesso ao sistema', variant: 'destructive' });
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast({ title: 'Digite um email válido', variant: 'destructive' });
        return;
      }
      if (!formData.password) {
        toast({ title: 'Senha é obrigatória para usuários com acesso ao sistema', variant: 'destructive' });
        return;
      }
    }

    if (!editingUser && formData.password && formData.password.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        // Update existing user
        const response = await supabase.functions.invoke('admin-users', {
          body: { 
            action: 'update',
            userId: editingUser.id,
            name: formData.name,
            role: formData.role,
            job_title: formData.job_title,
            avatar_url: formData.avatar_url,
            state: formData.state,
            employment_type: formData.employment_type
          },
        });

        const editErrorMsg = response.data?.error || response.error?.message;
        if (editErrorMsg) throw new Error(translateAuthError(editErrorMsg));

        // Função do colaborador é resolvida via profiles.job_title em tempo de leitura

        // Persist site assignments (backend validates super_admin permission).
        // Skip only when the *resulting* role is super_admin (acesso total automático).
        if (formData.role !== 'super_admin') {
          const sitesResp = await supabase.functions.invoke('admin-users', {
            body: { action: 'set-user-sites', userId: editingUser.id, siteIds: Array.from(assignedSiteIds) }
          });
          const sitesErr = sitesResp.data?.error || sitesResp.error?.message;
          if (sitesErr) throw new Error(sitesErr);
        }

        toast({ title: 'Usuário atualizado com sucesso' });
      } else {
        // Different flow for collaborators vs users with system access
        let createdUserId: string | null = null;
        if (formData.role === 'collaborator') {
          // Create collaborator without auth user
          const response = await supabase.functions.invoke('admin-users', {
            body: { 
              action: 'create-collaborator',
              name: formData.name,
              role: formData.role,
              job_title: formData.job_title,
              avatar_url: formData.avatar_url,
              state: formData.state,
              employment_type: formData.employment_type
            },
          });

          const collabErrorMsg = response.data?.error || response.error?.message;
          if (collabErrorMsg) throw new Error(translateAuthError(collabErrorMsg));
          createdUserId = response.data?.user?.id || null;
        } else {
          // Create new user with auth using email and password
          const response = await supabase.functions.invoke('admin-users', {
            body: { 
              action: 'create',
              email: formData.email.trim().toLowerCase(),
              password: formData.password,
              name: formData.name,
              role: formData.role,
              job_title: formData.job_title,
              avatar_url: formData.avatar_url,
              state: formData.state,
              employment_type: formData.employment_type
            },
          });

          const createErrorMsg = response.data?.error || response.error?.message;
          if (createErrorMsg) throw new Error(translateAuthError(createErrorMsg));
          createdUserId = response.data?.user?.id || null;
        }

        toast({ title: 'Usuário criado com sucesso' });

        // Persist site assignments for new user (super admin only)
        if (role === 'super_admin' && createdUserId && assignedSiteIds.size > 0 && formData.role !== 'super_admin') {
          const sitesResp = await supabase.functions.invoke('admin-users', {
            body: { action: 'set-user-sites', userId: createdUserId, siteIds: Array.from(assignedSiteIds) }
          });
          const sitesErr = sitesResp.data?.error || sitesResp.error?.message;
          if (sitesErr) throw new Error(sitesErr);
        }
      }

      setIsCreateEditOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Save user error:', error);
      toast({ 
        title: 'Erro ao salvar usuário', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!passwordData.newPassword) {
      toast({ title: 'Digite a nova senha', variant: 'destructive' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: 'As senhas não conferem', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const response = await supabase.functions.invoke('admin-users', {
        body: { 
          action: 'reset-password',
          userId: passwordData.userId,
          newPassword: passwordData.newPassword
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error);

      toast({ title: 'Senha redefinida com sucesso' });
      setIsPasswordOpen(false);
    } catch (error) {
      console.error('Password reset error:', error);
      toast({ 
        title: 'Erro ao redefinir senha', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.user) return;

    setSaving(true);
    try {
      const response = await supabase.functions.invoke('admin-users', {
        body: { 
          action: 'delete',
          userId: deleteDialog.user.id
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error);

      toast({ title: 'Usuário excluído com sucesso' });
      setDeleteDialog({ open: false, user: null });
      fetchUsers();
    } catch (error) {
      console.error('Delete user error:', error);
      toast({ 
        title: 'Erro ao excluir usuário', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  // Bulk delete all collaborators
  const collaboratorCount = users.filter(u => u.role === 'collaborator').length;

  const handleBulkDeleteCollaborators = async () => {
    setBulkDeleting(true);
    try {
      let totalDeleted = 0;
      const allErrors: string[] = [];
      const MAX_BATCHES = 200; // hard safety stop

      for (let i = 0; i < MAX_BATCHES; i++) {
        const response = await supabase.functions.invoke('admin-users', {
          body: { action: 'delete-all-collaborators' },
        });

        const data: any = response.data;
        if (response.error) {
          const msg = data?.error || data?.message || response.error.message;
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);

        totalDeleted += data?.deletedCount ?? 0;
        if (Array.isArray(data?.errors)) allErrors.push(...data.errors);

        if (!data?.hasMore) break;
      }

      toast({
        title: 'Colaboradores excluídos',
        description: `${totalDeleted} colaborador(es) removido(s)${allErrors.length ? ` · ${allErrors.length} erro(s)` : ''}`,
      });
      setBulkDeleteDialog(false);
      setBulkDeleteConfirmText('');
      fetchUsers();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast({ 
        title: 'Erro ao excluir colaboradores', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  // Selection functions
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectableUsers = filtered.filter(u => u.id !== user?.id);

  const selectAll = () => {
    const ids = new Set(selectableUsers.map(u => u.id));
    setSelectedUsers(ids);
  };

  const clearSelection = () => {
    setSelectedUsers(new Set());
    setSelectionMode(false);
  };

  const handleDeleteSelected = async () => {
    setBatchSelectDeleting(true);
    let deletedCount = 0;
    let errorCount = 0;

    try {
      for (const userId of selectedUsers) {
        try {
          const response = await supabase.functions.invoke('admin-users', {
            body: { action: 'delete', userId }
          });

          if (response.error || response.data.error) {
            errorCount++;
          } else {
            deletedCount++;
          }
        } catch {
          errorCount++;
        }
      }

      if (deletedCount > 0) {
        toast({ 
          title: 'Colaboradores excluídos', 
          description: `${deletedCount} colaborador(es) removido(s)${errorCount > 0 ? `, ${errorCount} erro(s)` : ''}` 
        });
      } else if (errorCount > 0) {
        toast({ 
          title: 'Erro ao excluir', 
          description: `Não foi possível excluir os colaboradores selecionados`,
          variant: 'destructive' 
        });
      }

      setBatchSelectDeleteDialog(false);
      clearSelection();
      fetchUsers();
    } catch (error) {
      console.error('Batch select delete error:', error);
      toast({ 
        title: 'Erro ao excluir colaboradores', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setBatchSelectDeleting(false);
    }
  };

  const handleSetUserPin = async () => {
    if (!/^\d{4}$/.test(pinInput)) {
      toast({ title: 'PIN deve ter 4 dígitos', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const response = await supabase.functions.invoke('admin-users', {
        body: { 
          action: 'set-user-pin',
          userId: pinDialog.user?.id,
          pin: pinInput
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: 'PIN configurado com sucesso' });
      setPinDialog({ open: false, user: null });
      setPinInput('');
    } catch (error) {
      console.error('Set PIN error:', error);
      toast({ 
        title: 'Erro ao configurar PIN', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUserPin = async () => {
    if (!removePinDialog.user) return;
    
    setSaving(true);
    try {
      const response = await supabase.functions.invoke('admin-users', {
        body: { 
          action: 'remove-user-pin',
          userId: removePinDialog.user.id
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: 'PIN removido com sucesso' });
      setRemovePinDialog({ open: false, user: null });
      fetchUsers();
    } catch (error) {
      console.error('Remove PIN error:', error);
      toast({ 
        title: 'Erro ao remover PIN', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center h-64">
          <EmptyState 
            icon={UserCog} 
            title="Acesso Restrito" 
            description="Apenas administradores e diretores podem gerenciar usuários"
          />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 md:pb-0 min-w-0">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl xs:text-2xl font-bold truncate">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} colaborador(es)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={selectionMode ? "secondary" : "outline"} 
            size="sm" 
            onClick={() => {
              if (selectionMode) {
                clearSelection();
              } else {
                setSelectionMode(true);
              }
            }}
          >
            <CheckSquare className="h-4 w-4 mr-1.5" />
            <span className="hidden xs:inline">{selectionMode ? 'Cancelar' : 'Selecionar'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
            <Download className="h-4 w-4 mr-1.5" />
            <span className="hidden xs:inline">Importar</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => exportUsersToCSV(filtered.map(u => ({
              name: u.name,
              email: u.email,
              role: u.role,
              company_name: '',
              created_at: u.created_at
            })))}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            <span className="hidden xs:inline">Exportar</span>
          </Button>
          {recordOnlyCount > 0 && role === 'super_admin' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setBulkDeleteDialog(true)}
              className="text-destructive border-destructive/30 hover:bg-destructive hover:text-white bg-destructive/5"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              <span className="hidden xs:inline">Excluir Todos</span>
            </Button>
          )}
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            <span className="hidden xs:inline">Novo</span>
          </Button>
        </div>
      </div>

      {/* Selection Mode Bar */}
      {selectionMode && (
        <div className="sticky top-0 z-10 bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={selectedUsers.size === selectableUsers.length && selectableUsers.length > 0}
              onCheckedChange={(checked) => checked ? selectAll() : setSelectedUsers(new Set())}
            />
            <span className="text-sm font-medium">
              {selectedUsers.size} selecionado(s)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4 mr-1.5" />
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => setBatchSelectDeleteDialog(true)}
              disabled={selectedUsers.size === 0}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Excluir ({selectedUsers.size})
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="pl-10" 
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole | 'all')}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="collaborator">Operacional</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Filial" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {branchOptions.map(branch => (
                <SelectItem key={branch.value} value={branch.value}>{branch.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState 
          icon={UserCog} 
          title="Nenhum colaborador encontrado" 
          description={searchTerm || roleFilter !== 'all' ? 'Tente ajustar os filtros' : 'Crie o primeiro colaborador'}
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Colaborador
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 xl:grid-cols-3">
          {filtered.map((userItem) => {
            const isSelected = selectedUsers.has(userItem.id);
            const isCurrentUser = userItem.id === user?.id;
            
            return (
              <Card 
                key={userItem.id} 
                className={cn(
                  "card-hover",
                  selectionMode && "cursor-pointer",
                  selectionMode && isSelected && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => {
                  if (selectionMode && !isCurrentUser) {
                    toggleUserSelection(userItem.id);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {selectionMode && (
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => toggleUserSelection(userItem.id)}
                        disabled={isCurrentUser}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1"
                      />
                    )}
                    <Avatar>
                      {userItem.avatar_url && <AvatarImage src={userItem.avatar_url} alt={userItem.name} />}
                      <AvatarFallback>
                        {userItem.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold truncate">{userItem.name}</h3>
                          {userItem.role !== 'collaborator' && userItem.email && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground truncate">{userItem.email}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <RoleBadge role={userItem.role} />
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                userItem.employment_type === 'intermitente'
                                  ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                                  : 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {userItem.employment_type === 'intermitente' ? 'Intermitente' : 'Fixo'}
                            </Badge>
                            {userItem.has_pin && userItem.role !== 'collaborator' && (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <Lock className="h-3 w-3" />
                                PIN
                              </Badge>
                            )}
                          </div>
                          {userItem.role === 'collaborator' && (
                            <div className="flex items-center gap-1 mt-1">
                              <UserX className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Somente registro</span>
                            </div>
                          )}
                          {userItem.job_title && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <Wrench className="h-3.5 w-3.5 text-primary" />
                              <span className="text-sm font-medium text-foreground">{userItem.job_title}</span>
                            </div>
                          )}
                          {userItem.state && (
                            <div className="flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{getBranchName(userItem.state)}</span>
                            </div>
                          )}
                          {userItem.role !== 'super_admin' && siteCounts[userItem.id] > 0 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openEdit(userItem); }}
                              className="flex items-center gap-1 mt-1 hover:text-primary transition-colors"
                              title="Editar fábricas com acesso"
                            >
                              <Factory className="h-3 w-3 text-primary" />
                              <span className="text-xs text-muted-foreground">
                                {siteCounts[userItem.id]} fábrica{siteCounts[userItem.id] !== 1 ? 's' : ''}
                              </span>
                            </button>
                          )}
                        </div>
                        {!selectionMode && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(userItem)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              {userItem.role !== 'collaborator' && (
                                <>
                                  <DropdownMenuItem onClick={() => openPasswordReset(userItem)}>
                                    <Key className="h-4 w-4 mr-2" />
                                    Redefinir Senha
                                  </DropdownMenuItem>
                                  {role === 'super_admin' && (
                                    <>
                                      <DropdownMenuItem onClick={() => {
                                        setPinDialog({ open: true, user: userItem });
                                        setPinInput('');
                                      }}>
                                        <KeyRound className="h-4 w-4 mr-2" />
                                        {userItem.has_pin ? 'Alterar PIN' : 'Definir PIN'}
                                      </DropdownMenuItem>
                                      {userItem.has_pin && (
                                        <DropdownMenuItem 
                                          onClick={() => setRemovePinDialog({ open: true, user: userItem })}
                                          className="text-amber-600"
                                        >
                                          <LockOpen className="h-4 w-4 mr-2" />
                                          Remover PIN
                                        </DropdownMenuItem>
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setDeleteDialog({ open: true, user: userItem })} 
                                className="text-destructive"
                                disabled={isCurrentUser}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit User Dialog */}
      <Dialog open={isCreateEditOpen} onOpenChange={setIsCreateEditOpen}>
        <DialogContent className="max-h-[90vh]">
          <DialogHeader>
          <DialogTitle>{editingUser ? 'Editar' : 'Novo'} Colaborador</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Atualize as informações do colaborador' : 'Preencha os dados para criar um novo colaborador'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            <div className="flex justify-center">
              <AvatarUpload
                currentUrl={formData.avatar_url}
                name={formData.name || 'Novo Usuário'}
                onUpload={(url) => setFormData(p => ({ ...p, avatar_url: url }))}
                size="lg"
              />
            </div>
            <div>
              <Label>Nome *</Label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} 
                placeholder="Nome completo"
              />
            </div>
            {!editingUser && formData.role !== 'collaborator' && (
              <>
                <div>
                  <Label>Email *</Label>
                  <Input 
                    type="email"
                    value={formData.email} 
                    onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} 
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <Label>Senha *</Label>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"}
                      value={formData.password} 
                      onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))} 
                      placeholder="Mínimo 6 caracteres"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
            <div>
              <Label>Papel</Label>
              <Select value={formData.role} onValueChange={(v: UserRole) => setFormData(p => ({ ...p, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collaborator">Operacional</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  {role === 'super_admin' && (
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Função</Label>
              <FunctionSelect
                value={formData.job_title}
                onChange={(v) => setFormData(p => ({ ...p, job_title: v }))}
                placeholder="Selecione a função"
              />
            </div>
            <div>
              <Label>Filial</Label>
              <Select value={formData.state} onValueChange={(v) => setFormData(p => ({ ...p, state: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a filial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="joao-neiva-es">Espírito Santo</SelectItem>
                  <SelectItem value="pecem-ce">Ceará</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vínculo</Label>
              <Select
                value={formData.employment_type}
                onValueChange={(v: 'fixo' | 'intermitente') =>
                  setFormData(p => ({ ...p, employment_type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vínculo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo">Fixo (funcionário próprio)</SelectItem>
                  <SelectItem value="intermitente">Intermitente (contratado por tempo)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                Use "Intermitente" para colaboradores contratados por período determinado.
              </p>
            </div>

            {/* Site access — super admin only */}
            {role === 'super_admin' && formData.role !== 'super_admin' && (
              <div>
                <SiteAccessSelector
                  selectedSiteIds={assignedSiteIds}
                  onChange={setAssignedSiteIds}
                />
                <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                  Selecione as fábricas que este colaborador poderá acessar.
                </p>
              </div>
            )}
            {role === 'super_admin' && formData.role === 'super_admin' && (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
                <Factory className="h-4 w-4 text-primary" />
                Super admins têm acesso a todas as fábricas automaticamente.
              </div>
            )}
          </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Digite a nova senha para {passwordData.userName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nova Senha *</Label>
              <div className="relative">
                <Input 
                  type={showNewPassword ? "text" : "password"}
                  value={passwordData.newPassword} 
                  onChange={(e) => setPasswordData(p => ({ ...p, newPassword: e.target.value }))} 
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirmar Senha *</Label>
              <div className="relative">
                <Input 
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordData.confirmPassword} 
                  onChange={(e) => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))} 
                  placeholder="Repita a senha"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handlePasswordReset} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, user: open ? deleteDialog.user : null })}
        title="Excluir Colaborador"
        description={`Tem certeza que deseja excluir ${deleteDialog.user?.name}? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />

      {/* Import Collaborators Dialog */}
      <ImportCollaboratorsDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={fetchUsers}
      />

      {/* Bulk Delete Collaborators Dialog */}
      <Dialog open={bulkDeleteDialog} onOpenChange={(open) => {
        setBulkDeleteDialog(open);
        if (!open) setBulkDeleteConfirmText('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Excluir Colaboradores Importados
            </DialogTitle>
            <DialogDescription>
              Esta ação irá excluir permanentemente todos os colaboradores <strong>importados (Somente Registro)</strong>. 
              Colaboradores cadastrados manualmente com email real NÃO serão afetados. Esta ação NÃO pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-medium">
                ⚠️ {recordOnlyCount} colaborador(es) importado(s) serão excluídos permanentemente.
              </p>
            </div>
            
            <div>
              <Label>Digite "EXCLUIR TODOS" para confirmar:</Label>
              <Input
                value={bulkDeleteConfirmText}
                onChange={(e) => setBulkDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder="EXCLUIR TODOS"
                className="mt-2"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDeleteCollaborators}
              disabled={bulkDeleteConfirmText !== 'EXCLUIR TODOS' || bulkDeleting}
            >
              {bulkDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Select Delete Dialog */}
      <ConfirmDialog
        open={batchSelectDeleteDialog}
        onOpenChange={(open) => {
          if (!batchSelectDeleting) {
            setBatchSelectDeleteDialog(open);
          }
        }}
        title="Excluir Colaboradores Selecionados"
        description={`Tem certeza que deseja excluir ${selectedUsers.size} colaborador(es)? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={handleDeleteSelected}
        variant="destructive"
        isLoading={batchSelectDeleting}
      />

      {/* Set User PIN Dialog - Super Admin Only */}
      <Dialog open={pinDialog.open} onOpenChange={(open) => {
        setPinDialog({ open, user: open ? pinDialog.user : null });
        if (!open) setPinInput('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Definir PIN de Acesso Rápido
            </DialogTitle>
            <DialogDescription>
              Configure o PIN de 4 dígitos para {pinDialog.user?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <InputOTP 
                maxLength={4} 
                value={pinInput}
                onChange={setPinInput}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Este PIN será usado para login rápido na tela inicial
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialog({ open: false, user: null })} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSetUserPin} disabled={saving || pinInput.length !== 4}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove PIN Confirmation Dialog */}
      <ConfirmDialog
        open={removePinDialog.open}
        onOpenChange={(open) => setRemovePinDialog({ open, user: open ? removePinDialog.user : null })}
        title="Remover PIN de Acesso Rápido"
        description={`Tem certeza que deseja remover o PIN de ${removePinDialog.user?.name}? O usuário não poderá mais usar o acesso rápido até que um novo PIN seja configurado.`}
        confirmText="Remover PIN"
        cancelText="Cancelar"
        onConfirm={handleRemoveUserPin}
        isLoading={saving}
      />
    </div>
  );
}
