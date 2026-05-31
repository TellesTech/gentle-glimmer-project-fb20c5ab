-- Create table for client-side errors logging
CREATE TABLE public.app_client_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id),
  path TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  user_agent TEXT,
  extra JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.app_client_errors ENABLE ROW LEVEL SECURITY;

-- Anyone can insert errors (even before auth)
CREATE POLICY "Anyone can insert client errors"
ON public.app_client_errors
FOR INSERT
WITH CHECK (true);

-- Only super_admin can view errors
CREATE POLICY "Super admins can view client errors"
ON public.app_client_errors
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::user_role));

-- Super admins can delete old errors
CREATE POLICY "Super admins can delete client errors"
ON public.app_client_errors
FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::user_role));