CREATE TABLE public.whatsapp_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz DEFAULT now(),
  status text NOT NULL,
  details jsonb
);

ALTER TABLE public.whatsapp_health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view health logs"
  ON public.whatsapp_health_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
