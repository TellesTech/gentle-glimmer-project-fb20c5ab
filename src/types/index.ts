// User Roles - 3 níveis: Super Admin, Administrador, Operacional
export type UserRole = 'super_admin' | 'admin' | 'collaborator';

// Status types
export type ReportStatus = 'draft' | 'completed' | 'finalized' | 'sent' | 'signed';
export type ProjectStatus = string;
export type Shift = 'morning' | 'afternoon' | 'night';

// Expanded deviation types for improductivity
export type DeviationType = 
  | 'delay' 
  | 'equipment' 
  | 'safety' 
  | 'other'
  | 'weather'
  | 'materials'
  | 'labor'
  | 'stoppage'
  | 'contractor'
  | 'supplier'
  | 'project_design'
  | 'planning'
  | 'execution';

export type ImpactLevel = 'low' | 'medium' | 'high';

// Stage and Task status
export type StageStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
export type TaskStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

// User
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  companyId?: string;
  projectId?: string;
  teamId?: string;
  siteId?: string;
  active: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

// Company
export interface Company {
  id: string;
  name: string;
  cnpj: string;
  logo?: string;
  photo?: string;
  address?: string;
  phone?: string;
  email?: string;
  active: boolean;
  createdAt: Date;
}

// Site (Unidade)
export interface Site {
  id: string;
  companyId: string;
  name: string;
  city: string;
  state: string;
  photo?: string;
  address?: string;
  active: boolean;
  createdAt: Date;
}

// Project (Obra)
export interface Project {
  id: string;
  companyId: string;
  siteId: string;
  name: string;
  code: string;
  location: string;
  photo?: string;
  startDate: Date;
  expectedEndDate?: Date;
  status: ProjectStatus;
  supervisorId: string;
  active: boolean;
}

// Team (Equipe)
export interface Team {
  id: string;
  projectId: string;
  name: string;
  leaderId: string;
  active: boolean;
}

// Project Stage (Etapa)
export interface ProjectStage {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  orderIndex: number;
  status: StageStatus;
  color: string;
  plannedStart?: Date;
  plannedEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

// Project Task (Tarefa)
export interface ProjectTask {
  id: string;
  stageId: string;
  projectId: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  orderIndex: number;
  plannedStart?: Date;
  plannedEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  progress: number;
  assignedTo?: string;
  estimatedHours?: number;
  actualHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Project Equipment
export interface ProjectEquipment {
  id: string;
  projectId: string;
  name: string;
  type?: string;
  model?: string;
  quantity: number;
  dailyRate?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Report Equipment Usage
export interface ReportEquipment {
  id: string;
  reportId: string;
  equipmentId?: string;
  equipmentName: string;
  hoursUsed?: number;
  quantityUsed: number;
  status: string;
  observations?: string;
  createdAt: Date;
}

// Activity
export interface Activity {
  id: string;
  reportId: string;
  description: string;
  completed: boolean;
  order: number;
}

// Deviation (Desvio)
export interface Deviation {
  id: string;
  reportId: string;
  description: string;
  type: DeviationType;
  impact: ImpactLevel;
  correctiveAction?: string;
  resolved: boolean;
}

// Attendance (Efetivo)
export interface Attendance {
  id: string;
  reportId: string;
  userId: string;
  userName: string;
  present: boolean;
  arrivalTime?: string;
  departureTime?: string;
  functionRole?: string;
}

// Photo
export interface Photo {
  id: string;
  reportId: string;
  url: string;
  description?: string;
  activityId?: string;
  deviationId?: string;
  uploadedAt: Date;
}

// Signature
export interface Signature {
  id: string;
  reportId: string;
  signerName: string;
  signerRole?: string;
  signatureData: string;
  signedAt: Date;
  ipAddress?: string;
}

// Report (Relatório)
export interface Report {
  id: string;
  teamId: string;
  projectId: string;
  projectName: string;
  teamName: string;
  createdById: string;
  createdByName: string;
  approvedById?: string;
  approvedByName?: string;
  date: Date;
  shift: Shift;
  activityLocation: string;
  startTime: string;
  endTime: string;
  radioFrequencyWees?: string;
  radioFrequencyOperation?: string;
  maintenanceOrderTitle: string;
  maintenanceOrderNumber?: string;
  ambulancePoint?: string;
  meetingPoint?: string;
  arrivalTimeAtLiberator?: string;
  documentReleaseTime?: string;
  blockRevalidationTime?: string;
  status: ReportStatus;
  activities: Activity[];
  deviations: Deviation[];
  attendance: Attendance[];
  photos: Photo[];
  equipment?: ReportEquipment[];
  signatures?: Signature[];
  comments?: string;
  routine?: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  
  // Novos campos RDO
  contractNumber?: string;
  technicalResponsibleName?: string;
  technicalResponsibleRole?: string;
  supervisorName?: string;
  supervisorRole?: string;
  plannedWorkforce?: number;
  actualWorkforce?: number;
  realPercentage?: number;
  finalizedAt?: Date;
  sentAt?: Date;
}

// Notification
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  link?: string;
  createdAt: Date;
}

// Dashboard Stats
export interface DashboardStats {
  totalReports: number;
  pendingReports: number;
  approvedReports: number;
  rejectedReports: number;
  totalDeviations: number;
  criticalDeviations: number;
  averageTeamSize: number;
  approvalRate: number;
}

// Chart Data
export interface ChartDataPoint {
  name: string;
  value: number;
  fill?: string;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  category?: string;
}

// Auth Context
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
