import { z } from 'zod';

// Authentication schemas
export const loginSchema = z.object({
  email: z.string()
    .trim()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z.string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'Senha deve ter pelo menos 6 caracteres')
    .max(128, 'Senha muito longa'),
});

export const registerSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),
  email: z.string()
    .trim()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  phone: z.string()
    .trim()
    .max(20, 'Telefone muito longo')
    .optional()
    .or(z.literal('')),
  password: z.string()
    .min(6, 'Senha deve ter pelo menos 6 caracteres')
    .max(128, 'Senha muito longa'),
  confirmPassword: z.string()
    .min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

// User management schema
export const userSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),
  email: z.string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  phone: z.string()
    .trim()
    .max(20, 'Telefone muito longo')
    .optional()
    .or(z.literal('')),
  role: z.enum(['admin', 'collaborator', 'super_admin'], {
    errorMap: () => ({ message: 'Cargo inválido' }),
  }),
});

// Report schemas
export const reportSchema = z.object({
  projectId: z.string().uuid('ID do projeto inválido'),
  date: z.string().min(1, 'Data é obrigatória'),
  shift: z.enum(['morning', 'afternoon', 'night'], {
    errorMap: () => ({ message: 'Turno inválido' }),
  }),
  location: z.string()
    .trim()
    .max(200, 'Local muito longo')
    .optional()
    .or(z.literal('')),
  comments: z.string()
    .trim()
    .max(2000, 'Comentários muito longos')
    .optional()
    .or(z.literal('')),
  weather: z.string()
    .trim()
    .max(100, 'Clima muito longo')
    .optional()
    .or(z.literal('')),
  temperature: z.number()
    .min(-50, 'Temperatura inválida')
    .max(60, 'Temperatura inválida')
    .optional()
    .nullable(),
  startTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário inválido')
    .optional()
    .or(z.literal('')),
  endTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário inválido')
    .optional()
    .or(z.literal('')),
});

// Activity schema
export const activitySchema = z.object({
  description: z.string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(500, 'Descrição muito longa'),
  notes: z.string()
    .trim()
    .max(1000, 'Notas muito longas')
    .optional()
    .or(z.literal('')),
  progress: z.number()
    .min(0, 'Progresso inválido')
    .max(100, 'Progresso inválido')
    .optional(),
  completed: z.boolean().optional(),
});

// Deviation schema
export const deviationSchema = z.object({
  type: z.enum(['delay', 'equipment', 'safety', 'other'], {
    errorMap: () => ({ message: 'Tipo inválido' }),
  }),
  description: z.string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(1000, 'Descrição muito longa'),
  impact: z.enum(['low', 'medium', 'high'], {
    errorMap: () => ({ message: 'Impacto inválido' }),
  }).optional(),
  actionTaken: z.string()
    .trim()
    .max(1000, 'Ação muito longa')
    .optional()
    .or(z.literal('')),
});

// Company schema
export const companySchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(200, 'Nome muito longo'),
  cnpj: z.string()
    .trim()
    .max(20, 'CNPJ muito longo')
    .optional()
    .or(z.literal('')),
  email: z.string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo')
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .trim()
    .max(20, 'Telefone muito longo')
    .optional()
    .or(z.literal('')),
  address: z.string()
    .trim()
    .max(300, 'Endereço muito longo')
    .optional()
    .or(z.literal('')),
  city: z.string()
    .trim()
    .max(100, 'Cidade muito longa')
    .optional()
    .or(z.literal('')),
  state: z.string()
    .trim()
    .max(50, 'Estado muito longo')
    .optional()
    .or(z.literal('')),
});

// Project schema
export const projectSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(200, 'Nome muito longo'),
  code: z.string()
    .trim()
    .max(50, 'Código muito longo')
    .optional()
    .or(z.literal('')),
  description: z.string()
    .trim()
    .max(1000, 'Descrição muito longa')
    .optional()
    .or(z.literal('')),
  status: z.enum(['planning', 'in_progress', 'completed', 'suspended'], {
    errorMap: () => ({ message: 'Status inválido' }),
  }).optional(),
});

// Site schema
export const siteSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(200, 'Nome muito longo'),
  address: z.string()
    .trim()
    .max(300, 'Endereço muito longo')
    .optional()
    .or(z.literal('')),
  city: z.string()
    .trim()
    .max(100, 'Cidade muito longa')
    .optional()
    .or(z.literal('')),
  state: z.string()
    .trim()
    .max(50, 'Estado muito longo')
    .optional()
    .or(z.literal('')),
  latitude: z.number()
    .min(-90, 'Latitude inválida')
    .max(90, 'Latitude inválida')
    .optional()
    .nullable(),
  longitude: z.number()
    .min(-180, 'Longitude inválida')
    .max(180, 'Longitude inválida')
    .optional()
    .nullable(),
});

// Type exports for use in components
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type UserFormData = z.infer<typeof userSchema>;
export type ReportFormData = z.infer<typeof reportSchema>;
export type ActivityFormData = z.infer<typeof activitySchema>;
export type DeviationFormData = z.infer<typeof deviationSchema>;
export type CompanyFormData = z.infer<typeof companySchema>;
export type ProjectFormData = z.infer<typeof projectSchema>;
export type SiteFormData = z.infer<typeof siteSchema>;

// Helper function to validate and parse data
export type ValidationSuccess<T> = { success: true; data: T };
export type ValidationError = { success: false; errors: Record<string, string> };
export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    if (err.path.length > 0) {
      errors[err.path.join('.')] = err.message;
    }
  });
  
  return { success: false, errors };
}
