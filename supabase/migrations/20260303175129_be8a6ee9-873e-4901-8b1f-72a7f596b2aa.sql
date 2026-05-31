
-- Create enum for backup frequency
CREATE TYPE public.backup_frequency AS ENUM ('daily', 'weekly', 'monthly');

-- Create enum for backup status
CREATE TYPE public.backup_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- Create backup_schedules table
CREATE TABLE public.backup_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  frequency backup_frequency NOT NULL DEFAULT 'weekly',
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  include_photos BOOLEAN NOT NULL DEFAULT false,
  include_pdfs BOOLEAN NOT NULL DEFAULT false,
  period_days INTEGER DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create backup_history table
CREATE TABLE public.backup_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES public.backup_schedules(id) ON DELETE SET NULL,
  status backup_status NOT NULL DEFAULT 'pending',
  file_path TEXT,
  file_size BIGINT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  drive_file_id TEXT,
  drive_file_url TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for backup_schedules
CREATE POLICY "Admins can manage backup schedules"
ON public.backup_schedules
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- RLS policies for backup_history
CREATE POLICY "Admins can view backup history"
ON public.backup_history
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Admins can insert backup history"
ON public.backup_history
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

CREATE POLICY "Admins can update backup history"
ON public.backup_history
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_backup_schedules_updated_at
BEFORE UPDATE ON public.backup_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
