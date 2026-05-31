import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, AlertTriangle, TrendingUp, TrendingDown, Users, Factory, MapPin, FileText, User, Briefcase, Building2, BarChart3, Check, ChevronsUpDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { ReportFormData } from '@/pages/ReportForm';
import type { Team, Project, Shift } from '@/types';

interface EligibleSupervisor {
  id: string;
  name: string;
}

interface StepBasicInfoProps {
  data: ReportFormData;
  onChange: (data: Partial<ReportFormData>) => void;
  teams: Team[];
  projects: Project[];
  eligibleSupervisors?: EligibleSupervisor[];
}

export function StepBasicInfo({ data, onChange, teams, projects, eligibleSupervisors = [] }: StepBasicInfoProps) {
  const [supervisorPopoverOpen, setSupervisorPopoverOpen] = useState(false);
  const filteredTeams = teams.filter(t => t.projectId === data.projectId);
  
  // Calculate workforce percentage
  const actualWorkforce = data.actualWorkforce || 0;
  const plannedWorkforce = data.plannedWorkforce || 0;
  const calculatedPercentage = plannedWorkforce > 0 
    ? Math.round((actualWorkforce / plannedWorkforce) * 100) 
    : 0;
  const isOverPlanned = actualWorkforce > plannedWorkforce && plannedWorkforce > 0;
  const isUnderPlanned = actualWorkforce < plannedWorkforce && plannedWorkforce > 0;

  return (
    <div className="space-y-6">
      {/* EFETIVO E PORCENTAGENS - Card Unificado e Destacado */}
      <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            Efetivo e Porcentagens
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Inputs de Efetivo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Programado *</Label>
              <Input
                type="number"
                min="0"
                value={data.plannedWorkforce || ''}
                onChange={(e) => onChange({ plannedWorkforce: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="h-12 text-center text-xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Real</Label>
              <Input
                type="number"
                min="0"
                value={actualWorkforce || ''}
                onChange={(e) => onChange({ actualWorkforce: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="h-12 text-center text-xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">% Geral</Label>
              <div className={cn(
                "h-12 flex items-center justify-center rounded-md border bg-muted/50 text-xl font-bold gap-1",
                calculatedPercentage >= 80 ? 'text-green-600 border-green-200 bg-green-50' : 
                calculatedPercentage >= 50 ? 'text-amber-600 border-amber-200 bg-amber-50' : 
                'text-destructive border-destructive/20 bg-destructive/10'
              )}>
                {calculatedPercentage}%
                {plannedWorkforce > 0 && (
                  calculatedPercentage >= 100 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">% Real *</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={data.realPercentage || ''}
                onChange={(e) => onChange({ realPercentage: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="h-12 text-center text-xl font-bold text-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Gráfico Comparativo */}
          {plannedWorkforce > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Comparativo</span>
              </div>
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { 
                        name: '% Geral', 
                        value: calculatedPercentage,
                        fill: calculatedPercentage >= 80 ? 'hsl(var(--chart-2))' : calculatedPercentage >= 50 ? 'hsl(var(--chart-4))' : 'hsl(var(--destructive))'
                      },
                      { 
                        name: '% Real', 
                        value: data.realPercentage || 0,
                        fill: 'hsl(var(--chart-1))'
                      }
                    ]}
                    layout="vertical"
                    margin={{ top: 0, right: 30, left: 60, bottom: 0 }}
                  >
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} />
                    <YAxis type="category" dataKey="name" width={55} fontSize={11} />
                    <Tooltip 
                      formatter={(value: number) => [`${value}%`, '']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {[
                        { fill: calculatedPercentage >= 80 ? 'hsl(var(--chart-2))' : calculatedPercentage >= 50 ? 'hsl(var(--chart-4))' : 'hsl(var(--destructive))' },
                        { fill: 'hsl(var(--chart-1))' }
                      ].map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col sm:flex-row justify-between text-xs text-muted-foreground mt-2 gap-1">
                <span>% Geral = Efetivo Real ÷ Programado</span>
                <span>% Real = Progresso da Atividade</span>
              </div>
            </div>
          )}

          {/* Alertas */}
          {isOverPlanned && (
            <Alert className="border-amber-500 bg-amber-500/10 mt-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                <strong>Atenção:</strong> Efetivo real ({actualWorkforce}) excede o programado ({plannedWorkforce})
              </AlertDescription>
            </Alert>
          )}

          {isUnderPlanned && calculatedPercentage < 80 && (
            <Alert className="border-destructive bg-destructive/10 mt-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive">
                <strong>Alerta:</strong> Efetivo real está abaixo de 80% do programado
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Date & Shift Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="text-base font-semibold flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Data e Turno
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Date */}
            <div className="space-y-2">
              <Label className="text-sm">Data do Relatório *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !data.date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {data.date ? format(data.date, 'dd/MM/yyyy') : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={data.date}
                    onSelect={(date) => date && onChange({ date })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Shift */}
            <div className="space-y-2">
              <Label className="text-sm">Turno *</Label>
              <Select value={data.shift} onValueChange={(v: Shift) => onChange({ shift: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Manhã</SelectItem>
                  <SelectItem value="afternoon">Tarde</SelectItem>
                  <SelectItem value="night">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Time */}
            <div className="space-y-2">
              <Label className="text-sm">Horário Início *</Label>
              <Input
                type="time"
                value={data.startTime}
                onChange={(e) => onChange({ startTime: e.target.value })}
              />
            </div>

            {/* End Time */}
            <div className="space-y-2">
              <Label className="text-sm">Horário Fim *</Label>
              <Input
                type="time"
                value={data.endTime}
                onChange={(e) => onChange({ endTime: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project & Team Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Factory className="h-4 w-4" />
            Atividade e Equipe
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Project */}
            <div className="space-y-2">
              <Label className="text-sm">Atividade *</Label>
              <Select 
                value={data.projectId} 
                onValueChange={(v) => onChange({ projectId: v, teamId: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a atividade" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Team */}
            <div className="space-y-2">
              <Label className="text-sm">Equipe *</Label>
              <Select 
                value={data.teamId} 
                onValueChange={(v) => onChange({ teamId: v })}
                disabled={!data.projectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={data.projectId ? 'Selecione a equipe' : 'Selecione uma atividade primeiro'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredTeams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location & Contract Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="text-base font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Local e Contrato
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Activity Location */}
            <div className="space-y-2">
              <Label className="text-sm">Local da Atividade *</Label>
              <Input
                value={data.activityLocation}
                onChange={(e) => onChange({ activityLocation: e.target.value })}
                placeholder="Ex: Bloco A - 5º Andar"
              />
            </div>

            {/* Contract Number */}
            <div className="space-y-2">
              <Label className="text-sm">Número do Contrato *</Label>
              <Input
                value={data.contractNumber}
                onChange={(e) => onChange({ contractNumber: e.target.value })}
                placeholder="Ex: CONT-2025-001"
              />
            </div>

            {/* Maintenance Order Title */}
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-sm">Título da OM *</Label>
              <Input
                value={data.maintenanceOrderTitle}
                onChange={(e) => onChange({ maintenanceOrderTitle: e.target.value })}
                placeholder="Ex: OM-2026-1217-001"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client/Contractor Card */}
      <Card className="border-l-4 border-l-blue-500 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" />
            Cliente / Contratante
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clientName" className="text-sm">Nome do Cliente</Label>
            <Input
              id="clientName"
              value={data.clientName || ''}
              onChange={(e) => onChange({ clientName: e.target.value })}
              placeholder="Nome do cliente responsável"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientCompany" className="text-sm">Empresa Contratante</Label>
            <Input
              id="clientCompany"
              value={data.clientCompany || ''}
              onChange={(e) => onChange({ clientCompany: e.target.value })}
              placeholder="Nome da empresa contratante"
            />
          </div>
        </CardContent>
      </Card>

      {/* Technical Responsible Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            Responsável Técnico / Central
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Nome *</Label>
              <Input
                value={data.technicalResponsibleName}
                onChange={(e) => onChange({ technicalResponsibleName: e.target.value })}
                placeholder="Nome do responsável"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Função</Label>
              <Input
                value={data.technicalResponsibleRole}
                onChange={(e) => onChange({ technicalResponsibleRole: e.target.value })}
                placeholder="Ex: Engenheiro de Campo"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supervisor Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Supervisor
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Nome *</Label>
              <Popover open={supervisorPopoverOpen} onOpenChange={setSupervisorPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    role="combobox" 
                    aria-expanded={supervisorPopoverOpen}
                    className="w-full justify-between font-normal"
                  >
                    {data.supervisorName || 'Selecione um supervisor'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar supervisor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum supervisor encontrado</CommandEmpty>
                      <CommandGroup>
                        {eligibleSupervisors.map((supervisor) => (
                          <CommandItem
                            key={supervisor.id}
                            value={supervisor.name}
                            onSelect={() => {
                              onChange({ supervisorName: supervisor.name });
                              setSupervisorPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", 
                              data.supervisorName === supervisor.name ? "opacity-100" : "opacity-0"
                            )} />
                            {supervisor.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Cargo</Label>
              <Input
                value={data.supervisorRole}
                onChange={(e) => onChange({ supervisorRole: e.target.value })}
                placeholder="Ex: Supervisor de Atividades"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card de Efetivo removido - agora está unificado no topo */}
    </div>
  );
}
