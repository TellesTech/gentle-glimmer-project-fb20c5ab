import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Plus, UserMinus, Crown, Users, UserPlus, Search, Check, GripVertical } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import type { Database } from "@/integrations/supabase/types";

type Team = Database["public"]["Tables"]["teams"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];
type Site = Database["public"]["Tables"]["sites"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
type UserRole = Database["public"]["Enums"]["user_role"];

interface MemberWithProfile extends TeamMember {
  profile: Profile | null;
}

export default function TeamDetails() {
  const { teamId } = useParams<{ teamId: string }>();
  const { role } = useAuth();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [leader, setLeader] = useState<Profile | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [memberToRemove, setMemberToRemove] = useState<MemberWithProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("existing");
  
  // New member form state
  const [newMemberForm, setNewMemberForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "collaborator" as UserRole
  });
  const [creating, setCreating] = useState(false);

  const canManageMembers = ["super_admin", "admin", "director", "supervisor", "leader"].includes(role || "");

  const fetchData = async () => {
    if (!teamId) return;
    
    setLoading(true);
    try {
      // Fetch team
      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // Fetch project
      const { data: projectData } = await supabase
        .from("projects")
        .select("*")
        .eq("id", teamData.project_id)
        .single();
      setProject(projectData);

      if (projectData) {
        // Fetch site
        const { data: siteData } = await supabase
          .from("sites")
          .select("*")
          .eq("id", projectData.site_id)
          .single();
        setSite(siteData);

        // Fetch company
        const { data: companyData } = await supabase
          .from("companies")
          .select("*")
          .eq("id", projectData.company_id)
          .single();
        setCompany(companyData);
      }

      // Fetch leader
      if (teamData.leader_id) {
        const { data: leaderData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", teamData.leader_id)
          .single();
        setLeader(leaderData);
      }

      // Fetch team members with profiles ordered by order_index
      const { data: membersData, error: membersError } = await supabase
        .from("team_members")
        .select("*")
        .eq("team_id", teamId)
        .order("order_index", { ascending: true });

      if (membersError) throw membersError;

      // Fetch profiles for members
      const membersWithProfiles: MemberWithProfile[] = [];
      for (const member of membersData || []) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", member.user_id)
          .single();
        membersWithProfiles.push({ ...member, profile });
      }
      setMembers(membersWithProfiles);

      // Fetch available users (not already in team)
      const memberIds = (membersData || []).map(m => m.user_id);
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("*")
        .order("name");
      
      const available = (allProfiles || []).filter(p => !memberIds.includes(p.id));
      setAvailableUsers(available);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0 || !teamId) {
      toast.error("Selecione pelo menos um usuário");
      return;
    }

    try {
      // Get current max order_index
      const maxOrderIndex = members.length > 0 
        ? Math.max(...members.map(m => (m as any).order_index || 0)) 
        : -1;

      const { error } = await supabase.from("team_members").insert(
        selectedUserIds.map((userId, index) => ({
          team_id: teamId,
          user_id: userId,
          order_index: maxOrderIndex + 1 + index,
        }))
      );

      if (error) throw error;
      toast.success(`${selectedUserIds.length} membro(s) adicionado(s)`);
      setAddDialogOpen(false);
      setSelectedUserIds([]);
      setSearchQuery("");
      fetchData();
    } catch (error) {
      console.error("Error adding members:", error);
      toast.error("Erro ao adicionar membros");
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;

    const items = Array.from(members);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately for responsiveness
    setMembers(items);

    // Save new order to database
    try {
      const updates = items.map((member, index) => 
        supabase
          .from("team_members")
          .update({ order_index: index })
          .eq("id", member.id)
      );

      await Promise.all(updates);
      toast.success("Ordem atualizada");
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Erro ao atualizar ordem");
      // Revert on error
      fetchData();
    }
  };

  const handleCreateAndAddMember = async () => {
    if (!newMemberForm.name || !newMemberForm.email) {
      toast.error("Nome e email são obrigatórios");
      return;
    }

    if (!teamId || !project?.company_id) {
      toast.error("Erro ao identificar equipe ou empresa");
      return;
    }

    // Check if user already exists in available users
    const existingUser = availableUsers.find(
      u => u.email.toLowerCase() === newMemberForm.email.toLowerCase()
    );
    
    if (existingUser) {
      toast.info("Este usuário já existe. Adicionando à equipe...");
      try {
        const { error } = await supabase.from("team_members").insert({
          team_id: teamId,
          user_id: existingUser.id,
        });
        if (error) throw error;
        toast.success("Membro adicionado à equipe");
        setAddDialogOpen(false);
        setNewMemberForm({ name: "", email: "", phone: "", role: "collaborator" });
        setActiveTab("existing");
        fetchData();
        return;
      } catch (error) {
        console.error("Error adding existing member:", error);
        toast.error("Erro ao adicionar membro existente");
        return;
      }
    }

    // Check if user is already a member
    const isMember = members.some(
      m => m.profile?.email?.toLowerCase() === newMemberForm.email.toLowerCase()
    );
    
    if (isMember) {
      toast.error("Este usuário já é membro desta equipe");
      return;
    }

    setCreating(true);
    try {
      // Create user via edge function
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: {
          action: "create",
          email: newMemberForm.email,
          password: Math.random().toString(36).slice(-12) + "A1!", // Temporary password
          name: newMemberForm.name,
          phone: newMemberForm.phone || null,
          role: newMemberForm.role,
          company_id: project.company_id
        }
      });

      // Handle error from edge function
      if (error) {
        const errorMessage = error.message || "";
        const isEmailExists = errorMessage.toLowerCase().includes("already been registered") || 
                              errorMessage.toLowerCase().includes("email_exists") ||
                              errorMessage.toLowerCase().includes("email address");
        if (isEmailExists) {
          toast.error("Este email já está cadastrado. Verifique na aba 'Existente'.");
          setActiveTab("existing");
          setSearchQuery(newMemberForm.email);
          return;
        }
        throw error;
      }
      
      if (data?.error) {
        const errorStr = String(data.error).toLowerCase();
        const isEmailExists = errorStr.includes("already been registered") || 
                              errorStr.includes("email_exists") ||
                              errorStr.includes("email address") ||
                              errorStr.includes("já está cadastrado");
        if (isEmailExists) {
          toast.error("Este email já está cadastrado. Verifique na aba 'Existente'.");
          setActiveTab("existing");
          setSearchQuery(newMemberForm.email);
          return;
        }
        throw new Error(data.error);
      }

      // Edge function returns { user: { id, email, name } } on success
      const newUserId = data?.user?.id;
      if (!newUserId) throw new Error("ID do usuário não retornado");

      // Add to team
      const { error: teamError } = await supabase.from("team_members").insert({
        team_id: teamId,
        user_id: newUserId,
      });

      if (teamError) throw teamError;

      toast.success("Membro criado e adicionado à equipe");
      setAddDialogOpen(false);
      setNewMemberForm({ name: "", email: "", phone: "", role: "collaborator" });
      setActiveTab("existing");
      fetchData();
    } catch (error: any) {
      console.error("Error creating member:", error);
      toast.error(error.message || "Erro ao criar membro");
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", memberToRemove.id);

      if (error) throw error;
      toast.success("Membro removido");
      setRemoveDialogOpen(false);
      setMemberToRemove(null);
      fetchData();
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Erro ao remover membro");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredUsers = availableUsers.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetDialog = () => {
    setSelectedUserIds([]);
    setSearchQuery("");
    setNewMemberForm({ name: "", email: "", phone: "", role: "collaborator" });
    setActiveTab("existing");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Equipe não encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList className="text-xs sm:text-sm flex-wrap">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/companies-manage">Fábricas</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/companies/${company?.id}`} className="max-w-[80px] xs:max-w-[100px] truncate inline-block">{company?.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/sites/${site?.id}`} className="max-w-[80px] xs:max-w-[100px] truncate inline-block">{site?.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/projects/${project?.id}`} className="max-w-[80px] xs:max-w-[100px] truncate inline-block">{project?.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[100px] truncate">{team.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl xs:text-2xl font-bold truncate">{team.name}</h1>
          <p className="text-sm text-muted-foreground truncate">
            {project?.name} • {site?.name} • {company?.name}
          </p>
        </div>
        {canManageMembers && (
          <Button size="sm" onClick={() => setAddDialogOpen(true)} className="w-fit">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Membro
          </Button>
        )}
      </div>

      {/* Leader Card */}
      {leader && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              Líder da Equipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={leader.avatar_url || undefined} />
                <AvatarFallback>{getInitials(leader.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{leader.name}</p>
                <p className="text-sm text-muted-foreground">{leader.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Membros ({members.length})
        </h2>

        {members.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum membro na equipe</p>
              {canManageMembers && (
                <Button className="mt-4" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Membro
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="members" direction="vertical">
              {(provided) => (
                <div 
                  {...provided.droppableProps} 
                  ref={provided.innerRef}
                  className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
                >
                  {members.map((member, index) => (
                    <Draggable 
                      key={member.id} 
                      draggableId={member.id} 
                      index={index}
                      isDragDisabled={!canManageMembers}
                    >
                      {(provided, snapshot) => (
                        <Card 
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`transition-shadow ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary" : ""}`}
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {canManageMembers && (
                                  <div 
                                    {...provided.dragHandleProps} 
                                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-muted"
                                  >
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <Avatar>
                                  <AvatarImage src={member.profile?.avatar_url || undefined} />
                                  <AvatarFallback>
                                    {member.profile ? getInitials(member.profile.name) : "??"}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{member.profile?.name || "Desconhecido"}</p>
                                  <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                                </div>
                              </div>
                              {canManageMembers && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setMemberToRemove(member);
                                    setRemoveDialogOpen(true);
                                  }}
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {/* Add Member Dialog with Tabs */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open);
        if (!open) resetDialog();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Membro</DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Existente
              </TabsTrigger>
              <TabsTrigger value="new" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Criar Novo
              </TabsTrigger>
            </TabsList>

            {/* Tab: Escolher Existente */}
            <TabsContent value="existing" className="space-y-4 mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {availableUsers.length === 0 
                    ? "Todos os usuários já são membros desta equipe."
                    : "Nenhum usuário encontrado."}
                </p>
              ) : (
                <>
                  {/* Quick action buttons */}
                  <div className="flex gap-2 justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {selectedUserIds.length > 0 && `${selectedUserIds.length} selecionado(s)`}
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedUserIds(filteredUsers.map(u => u.id))}
                      >
                        Selecionar Todos
                      </Button>
                      {selectedUserIds.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedUserIds([])}
                        >
                          Limpar
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedUserIds.includes(user.id) 
                            ? "bg-primary/10 border border-primary" 
                            : "bg-muted/50 hover:bg-muted"
                        }`}
                      >
                        {/* Checkbox visual */}
                        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          selectedUserIds.includes(user.id) 
                            ? "bg-primary border-primary text-primary-foreground" 
                            : "border-muted-foreground"
                        }`}>
                          {selectedUserIds.includes(user.id) && <Check className="h-3 w-3" />}
                        </div>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddMembers} disabled={selectedUserIds.length === 0}>
                  Adicionar {selectedUserIds.length > 0 && `(${selectedUserIds.length})`}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Tab: Criar Novo */}
            <TabsContent value="new" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="newName">Nome *</Label>
                  <Input
                    id="newName"
                    placeholder="Nome completo"
                    value={newMemberForm.name}
                    onChange={(e) => setNewMemberForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newEmail">Email *</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={newMemberForm.email}
                    onChange={(e) => setNewMemberForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newPhone">Telefone</Label>
                  <PhoneInput
                    id="newPhone"
                    placeholder="(00) 00000-0000"
                    value={newMemberForm.phone}
                    onChange={(value) => setNewMemberForm(prev => ({ ...prev, phone: value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newRole">Cargo</Label>
                  <Select 
                    value={newMemberForm.role} 
                    onValueChange={(value: UserRole) => setNewMemberForm(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="collaborator">Operador</SelectItem>
                      <SelectItem value="leader">Líder do Efetivo</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="hr">RH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreateAndAddMember} 
                  disabled={creating || !newMemberForm.name || !newMemberForm.email}
                >
                  {creating ? "Criando..." : "Criar e Adicionar"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <ConfirmDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        title="Remover Membro"
        description={`Tem certeza que deseja remover "${memberToRemove?.profile?.name}" da equipe?`}
        onConfirm={handleRemoveMember}
        confirmText="Remover"
        variant="destructive"
      />
    </div>
  );
}
