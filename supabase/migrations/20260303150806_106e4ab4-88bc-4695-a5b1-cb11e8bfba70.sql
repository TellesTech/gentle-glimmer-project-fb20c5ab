
CREATE TABLE public.api_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.api_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manage" ON public.api_connections
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
