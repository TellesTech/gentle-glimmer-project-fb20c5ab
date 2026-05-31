-- Create site_responsibles table to link users to specific sites
CREATE TABLE public.site_responsibles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id, user_id)
);

-- Enable RLS
ALTER TABLE public.site_responsibles ENABLE ROW LEVEL SECURITY;

-- Create function to get user's assigned site IDs
CREATE OR REPLACE FUNCTION public.get_user_site_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT site_id FROM public.site_responsibles
  WHERE user_id = _user_id
$$;

-- RLS Policy: Admins can manage all site_responsibles
CREATE POLICY "Admins can manage site_responsibles" 
ON public.site_responsibles
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role) OR
  has_role(auth.uid(), 'director'::user_role)
);

-- RLS Policy: Users can view their own assignments
CREATE POLICY "Users can view own site assignments" 
ON public.site_responsibles
FOR SELECT
USING (user_id = auth.uid());