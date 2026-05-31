import { useState, useEffect } from 'react';
import { Users, UserCheck, UserX, Clock, AlertTriangle, AlertCircle, TrendingUp, TrendingDown, Plus, Search, Check, ChevronsUpDown, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ReportFormData } from '@/pages/ReportForm';
import type { User, Attendance } from '@/types';

interface ProfileBasic {
  id: string;
  name: string;
  jobTitle?: string;
}

interface StepAttendanceProps {
  data: ReportFormData;
  onChange: (data: Partial<ReportFormData>) => void;
  teamMembers: User[];
  allProfiles?: ProfileBasic[];
  defaultArrivalTime?: string;
  defaultDepartureTime?: string;
}

const ROLE_TO_FUNCTION: Record<string, string> = {
  'super_admin': 'Supervisor',
  'admin': 'Supervisor',
  'collaborator': 'Convencional',
};

export function StepAttendance({ data, onChange, teamMembers, allProfiles = [], defaultArrivalTime = '07:00', defaultDepartureTime = '17:00' }: StepAttendanceProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Initialize attendance if empty and team is selected
  const initializeAttendance = () => {
    if (data.attendance.length === 0 && teamMembers.length > 0) {
      const initialAttendance: Attendance[] = teamMembers.map(member => ({
        id: `temp-${member.id}`,
        reportId: '',
        userId: member.id,
        userName: member.name,
        present: false,
        arrivalTime: defaultArrivalTime,
        departureTime: defaultDepartureTime,
        functionRole: (member as any).jobTitle || ROLE_TO_FUNCTION[member.role] || 'Convencional',
      }));
      onChange({ attendance: initialAttendance });
    }
  };

  // Call initialize on mount
  if (data.attendance.length === 0 && teamMembers.length > 0) {
    initializeAttendance();
  }

  // Fill missing functionRole for members already in attendance
  useEffect(() => {
    if (data.attendance.length === 0 || teamMembers.length === 0) return;

    const roleMap = new Map(teamMembers.map(m => [m.id, m.role]));
    let needsUpdate = false;

    const jobTitleMap = new Map(teamMembers.map(m => [m.id, (m as any).jobTitle || '']));

    const updated = data.attendance.map(a => {
      if (!a.functionRole && roleMap.has(a.userId)) {
        needsUpdate = true;
        return {
          ...a,
          functionRole: jobTitleMap.get(a.userId) || ROLE_TO_FUNCTION[roleMap.get(a.userId)!] || 'Convencional',
          arrivalTime: a.arrivalTime || '07:00',
          departureTime: a.departureTime || '17:00',
        };
      }
      return a;
    });

    if (needsUpdate) {
      onChange({ attendance: updated });
    }
  }, [teamMembers, data.attendance.length]);

  // Reconciliar attendance com dados atuais do cadastro (allProfiles)
  useEffect(() => {
    if (!allProfiles || allProfiles.length === 0 || data.attendance.length === 0) return;

    const profileMap = new Map(allProfiles.map(p => [p.id, p]));
    let needsUpdate = false;

    const updated = data.attendance.map(member => {
      if (!member.userId) return member;

      const profile = profileMap.get(member.userId);
      if (!profile) return member;

      const newName = profile.name || member.userName;
      const newFunction = profile.jobTitle || member.functionRole || 'Convencional';

      if (newName !== member.userName || newFunction !== member.functionRole) {
        needsUpdate = true;
        return { ...member, userName: newName, functionRole: newFunction };
      }
      return member;
    });

    if (needsUpdate) {
      onChange({ attendance: updated });
    }
  }, [allProfiles]);

  // Get IDs of team members for reference
  const teamMemberIds = new Set(teamMembers.map(m => m.id));

  // Get IDs of profiles already in attendance
  const attendanceUserIds = new Set(data.attendance.map(a => a.userId));

  // Filter profiles for the selector (exclude already added)
  const availableProfiles = allProfiles.filter(p => !attendanceUserIds.has(p.id));

  // Filter by search
  const filteredProfiles = searchValue
    ? availableProfiles.filter(p => 
        p.name.toLowerCase().includes(searchValue.toLowerCase())
      )
    : availableProfiles;

  const togglePresence = (memberId: string) => {
    onChange({
      attendance: data.attendance.map(a =>
        a.id === memberId ? { 
          ...a, 
          present: !a.present,
          arrivalTime: !a.present ? (a.arrivalTime || defaultArrivalTime) : a.arrivalTime,
          departureTime: !a.present ? (a.departureTime || defaultDepartureTime) : a.departureTime,
        } : a
      ),
    });
  };

  const updateTime = (memberId: string, field: 'arrivalTime' | 'departureTime', value: string) => {
    onChange({
      attendance: data.attendance.map(a =>
        a.id === memberId ? { ...a, [field]: value } : a
      ),
    });
  };




  const addCollaborator = (profile: ProfileBasic) => {
    const newAttendance: Attendance = {
      id: `temp-${profile.id}`,
      reportId: '',
      userId: profile.id,
      userName: profile.name,
      present: true,
      arrivalTime: defaultArrivalTime,
      departureTime: defaultDepartureTime,
      functionRole: profile.jobTitle || 'Convencional',
    };
    onChange({ attendance: [...data.attendance, newAttendance] });
  };

  const removeCollaborator = (memberId: string, userId: string | null) => {
    // Only allow removing if not a team member
    if (!userId || !teamMemberIds.has(userId)) {
      onChange({ attendance: data.attendance.filter(a => a.id !== memberId) });
    }
  };

  const selectAllAvailable = () => {
    const newAttendances: Attendance[] = availableProfiles.map(p => ({
      id: `temp-${p.id}`,
      reportId: '',
      userId: p.id,
      userName: p.name,
      present: true,
    }));
    onChange({ attendance: [...data.attendance, ...newAttendances] });
  };

  const clearAdditionalCollaborators = () => {
    // Keep only team members
    onChange({ 
      attendance: data.attendance.filter(a => teamMemberIds.has(a.userId)) 
    });
  };

  const presentCount = data.attendance.filter(a => a.present).length;
  const totalCount = data.attendance.length;
  const plannedWorkforce = data.plannedWorkforce || 0;
  const additionalCollaboratorsCount = data.attendance.filter(a => !teamMemberIds.has(a.userId)).length;
  
  // Calculate percentages
  const calculatedPercentage = plannedWorkforce > 0 
    ? Math.round((presentCount / plannedWorkforce) * 100) 
    : 0;
  
  // Check if actual workforce exceeds planned
  const isOverPlanned = presentCount > plannedWorkforce && plannedWorkforce > 0;
  const isUnderPlanned = presentCount < plannedWorkforce && plannedWorkforce > 0;

  return (
    <div className="space-y-6">
      {/* Workforce Summary Card */}
      {plannedWorkforce > 0 && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">📊 Resumo do Efetivo</Label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-background/80 rounded-lg">
                <p className="text-xs text-muted-foreground">Programado</p>
                <p className="text-2xl font-bold text-foreground">{plannedWorkforce}</p>
              </div>
              <div className="text-center p-3 bg-background/80 rounded-lg">
                <p className="text-xs text-muted-foreground">Presente</p>
                <p className={`text-2xl font-bold ${isOverPlanned ? 'text-warning' : isUnderPlanned ? 'text-destructive' : 'text-success'}`}>
                  {presentCount}
                </p>
              </div>
              <div className="text-center p-3 bg-background/80 rounded-lg">
                <p className="text-xs text-muted-foreground">% Geral</p>
                <div className="flex items-center justify-center gap-1">
                  <p className={`text-2xl font-bold ${calculatedPercentage >= 80 ? 'text-success' : calculatedPercentage >= 50 ? 'text-warning' : 'text-destructive'}`}>
                    {calculatedPercentage}%
                  </p>
                  {calculatedPercentage >= 100 ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
              <div className="text-center p-3 bg-background/80 rounded-lg">
                <p className="text-xs text-muted-foreground">% Real</p>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={data.realPercentage || ''}
                  onChange={(e) => onChange({ realPercentage: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-center text-lg font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {isOverPlanned && (
        <Alert className="border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            <strong>Atenção:</strong> Efetivo real ({presentCount}) excede o programado ({plannedWorkforce})
          </AlertDescription>
        </Alert>
      )}

      {isUnderPlanned && calculatedPercentage < 80 && (
        <Alert className="border-destructive bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">
            <strong>Alerta:</strong> Efetivo real ({presentCount}) está abaixo de 80% do programado
          </AlertDescription>
        </Alert>
      )}




      {/* Add Collaborators Section */}
      {allProfiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Colaboradores
              </Label>
              {additionalCollaboratorsCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAdditionalCollaborators}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar adicionais
                </Button>
              )}
            </div>
            
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Buscar colaboradores ({availableProfiles.length} disponíveis)
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(400px,calc(100vw-32px))] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Buscar por nome..." 
                    value={searchValue}
                    onValueChange={setSearchValue}
                  />
                  <div className="flex items-center gap-2 p-2 border-b">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={selectAllAvailable}
                      disabled={availableProfiles.length === 0}
                      className="flex-1 text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Selecionar todos
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearAdditionalCollaborators}
                      disabled={additionalCollaboratorsCount === 0}
                      className="flex-1 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Limpar
                    </Button>
                  </div>
                  <CommandList>
                    <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredProfiles.slice(0, 50).map((profile) => (
                        <CommandItem
                          key={profile.id}
                          value={profile.id}
                          onSelect={() => {
                            addCollaborator(profile);
                            // Keep popover open for multiple selections
                          }}
                          className="cursor-pointer"
                        >
                          <Avatar className="h-6 w-6 mr-2">
                            <AvatarFallback className="text-xs">
                              {profile.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{profile.name}</span>
                        </CommandItem>
                      ))}
                      {filteredProfiles.length > 50 && (
                        <div className="p-2 text-center text-xs text-muted-foreground">
                          Mostrando 50 de {filteredProfiles.length}. Refine sua busca.
                        </div>
                      )}
                    </CommandGroup>
                  </CommandList>
                  <div className="p-2 border-t text-center text-xs text-muted-foreground">
                    {totalCount} no efetivo • {presentCount} presentes
                  </div>
                </Command>
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <Label>Efetivo do Dia</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Registre a presença da equipe
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <UserCheck className="h-4 w-4 text-success" />
          <span>{presentCount}/{totalCount}</span>
        </div>
      </div>

      {/* Attendance List */}
      <div className="space-y-2">
        {data.attendance.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum membro na equipe</p>
            <p className="text-sm">Selecione uma equipe na etapa de informações básicas ou adicione colaboradores acima</p>
          </div>
        ) : (
          data.attendance.map((member) => {
            const isTeamMember = member.userId ? teamMemberIds.has(member.userId) : false;
            const isUnmatched = !member.userId && !isTeamMember;

            return (
              <div
                key={member.id}
                className={cn(
                  'p-3 border rounded-lg transition-colors',
                  isUnmatched
                    ? 'bg-destructive/5 border-destructive/40'
                    : member.present 
                      ? 'bg-success/5 border-success/20' 
                      : 'bg-muted/30'
                )}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={member.present}
                    onCheckedChange={() => togglePresence(member.id)}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={cn(
                      member.present ? 'bg-success/10 text-success' : '',
                      isUnmatched && 'bg-destructive/10 text-destructive'
                    )}>
                      {member.userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium truncate",
                      !member.present && 'text-muted-foreground',
                      isUnmatched && 'text-destructive'
                    )}>
                      {member.userName}{member.functionRole ? ` - ${member.functionRole}` : ''}
                    </p>
                    {isUnmatched ? (
                      <p className="text-[10px] font-bold text-destructive flex items-center gap-1 uppercase mt-0.5">
                        <AlertTriangle className="h-3 w-3" />
                        Colaborador não encontrado
                      </p>
                    ) : !isTeamMember && (
                      <p className="text-xs text-muted-foreground">Adicionado manualmente</p>
                    )}
                  </div>
                  {!isTeamMember && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCollaborator(member.id, member.userId)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {isUnmatched ? (
                    <AlertCircle className="h-4 w-4 text-destructive animate-pulse" />
                  ) : member.present ? (
                    <UserCheck className="h-4 w-4 text-success" />
                  ) : (
                    <UserX className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Time and function inputs when present */}
                {member.present && (
                  <div className="grid grid-cols-2 gap-3 mt-3 pl-11">
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Entrada
                      </Label>
                      <Input
                        type="time"
                        value={member.arrivalTime || ''}
                        onChange={(e) => updateTime(member.id, 'arrivalTime', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Saída
                      </Label>
                      <Input
                        type="time"
                        value={member.departureTime || ''}
                        onChange={(e) => updateTime(member.id, 'departureTime', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      {data.attendance.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
          <div className="flex items-center gap-1">
            <UserCheck className="h-4 w-4 text-success" />
            {presentCount} presentes
          </div>
          <div className="flex items-center gap-1">
            <UserX className="h-4 w-4" />
            {totalCount - presentCount} ausentes
          </div>
          {additionalCollaboratorsCount > 0 && (
            <div className="flex items-center gap-1 text-primary">
              <Plus className="h-4 w-4" />
              {additionalCollaboratorsCount} adicionais
            </div>
          )}
          {plannedWorkforce > 0 && (
            <div className="ml-auto font-medium">
              Eficiência: {calculatedPercentage}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
