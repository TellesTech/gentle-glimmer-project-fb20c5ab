-- Add new columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS client_responsible_name text,
ADD COLUMN IF NOT EXISTS supervisor_name text,
ADD COLUMN IF NOT EXISTS contract_number text;

-- Create project_members table
CREATE TABLE public.project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view project members from their company
CREATE POLICY "Users can view project members"
  ON public.project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND (p.company_id = get_user_company_id(auth.uid()) 
           OR has_role(auth.uid(), 'admin'::user_role)
           OR has_role(auth.uid(), 'director'::user_role)
           OR has_role(auth.uid(), 'supervisor'::user_role))
    )
  );

-- Policy: Managers can manage project members
CREATE POLICY "Managers can manage project members"
  ON public.project_members FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'director'::user_role)
    OR has_role(auth.uid(), 'supervisor'::user_role)
    OR has_role(auth.uid(), 'leader'::user_role)
    OR has_role(auth.uid(), 'super_admin'::user_role)
  );