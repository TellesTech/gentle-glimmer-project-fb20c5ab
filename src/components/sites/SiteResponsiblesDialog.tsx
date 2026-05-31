import { useState, useEffect } from 'react';
import { Loader2, Plus, X, UserCheck, Users, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  job_title: string | null;
}

interface SiteResponsible {
  id: string;
  user_id: string;
  profile: Profile;
}

interface SiteResponsiblesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  siteName: string;
  currentPortalCollaboratorId?: string | null;
  onPortalCollaboratorChange?: (profileId: string | null) => void;
}

export function SiteResponsiblesDialog({
  open,
  onOpenChange,
  siteId,
  siteName,
  currentPortalCollaboratorId,
  onPortalCollaboratorChange,
}: SiteResponsiblesDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [responsibles, setResponsibles] = useState<SiteResponsible[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [portalCollaboratorId, setPortalCollaboratorId] = useState<string>(currentPortalCollaboratorId || '');
  const [allAdmins, setAllAdmins] = useState<Profile[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch current responsibles for this site
      const { data: responsiblesData, error: responsiblesError } = await supabase
        .from('site_responsibles')
        .select('id, user_id')
        .eq('site_id', siteId);

      if (responsiblesError) throw responsiblesError;

      const userIds = responsiblesData?.map(r => r.user_id) || [];

      // Fetch profiles for responsibles
      let responsiblesWithProfiles: SiteResponsible[] = [];
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url, job_title')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        responsiblesWithProfiles = (responsiblesData || []).map(r => ({
          id: r.id,
          user_id: r.user_id,
          profile: profilesData?.find(p => p.id === r.user_id) as Profile,
        })).filter(r => r.profile);
      }

      setResponsibles(responsiblesWithProfiles);

      // Fetch all available users (excluding already assigned)
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url, job_title')
        .order('name');

      if (allProfilesError) throw allProfilesError;

      const available = (allProfiles || []).filter(
        p => !userIds.includes(p.id)
      );
      setAvailableUsers(available);

      // Fetch admins for portal collaborator selector
      const { data: adminData } = await supabase.rpc('get_eligible_supervisors');
      if (adminData) {
        // Enrich with profile data
        const adminIds = (adminData as any[]).map(a => a.id);
        const enriched = (allProfiles || []).filter(p => adminIds.includes(p.id));
        setAllAdmins(enriched);
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && siteId) {
      fetchData();
      setSelectedUserId('');
      setPortalCollaboratorId(currentPortalCollaboratorId || '');
    }
  }, [open, siteId, currentPortalCollaboratorId]);

  const handleSavePortalCollaborator = async (value: string) => {
    const newId = value === '__none__' ? null : value;
    setPortalCollaboratorId(value === '__none__' ? '' : value);
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sites')
        .update({ portal_collaborator_id: newId } as any)
        .eq('id', siteId);
      if (error) throw error;
      toast({ title: newId ? 'Colaborador do portal definido' : 'Colaborador do portal removido' });
      onPortalCollaboratorChange?.(newId);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedUserId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_responsibles')
        .insert({ site_id: siteId, user_id: selectedUserId });

      if (error) throw error;

      toast({ title: 'Responsável adicionado' });
      setSelectedUserId('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (responsibleId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_responsibles')
        .delete()
        .eq('id', responsibleId);

      if (error) throw error;

      toast({ title: 'Responsável removido' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Responsáveis WEES
          </DialogTitle>
          <DialogDescription>
            Gerencie os responsáveis da WEES pela unidade <strong>{siteName}</strong>. 
            Usuários vinculados terão acesso restrito a esta unidade.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Responsibles */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                Responsáveis atuais ({responsibles.length})
              </div>
              
              {responsibles.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  Nenhum responsável vinculado a esta unidade
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {responsibles.map((resp) => (
                    <div
                      key={resp.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={resp.profile.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(resp.profile.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{resp.profile.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {resp.profile.job_title || resp.profile.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(resp.id)}
                        disabled={saving}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Responsible */}
            <div className="border-t pt-4 space-y-3">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Adicionar responsável
              </div>
              
              {availableUsers.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">
                  Todos os usuários já foram vinculados
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um usuário..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <span>{user.name}</span>
                            {user.job_title && (
                              <Badge variant="secondary" className="text-xs">
                                {user.job_title}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAdd}
                    disabled={!selectedUserId || saving}
                    size="icon"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Portal Collaborator Selector */}
            <div className="border-t pt-4 space-y-3">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Colaborador visível no Portal do Cliente
              </div>
              <p className="text-xs text-muted-foreground">
                Escolha qual colaborador WEES será exibido na tela de login do cliente para esta unidade.
              </p>
              <Select value={portalCollaboratorId || '__none__'} onValueChange={handleSavePortalCollaborator}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhum selecionado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {allAdmins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      <div className="flex items-center gap-2">
                        <span>{admin.name}</span>
                        {admin.job_title && (
                          <Badge variant="secondary" className="text-xs">
                            {admin.job_title}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
