
-- Tabela de mapeamento grupo WhatsApp → projeto
CREATE TABLE public.whatsapp_group_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL UNIQUE,
  group_name TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  created_by UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de log de mensagens processadas
CREATE TABLE public.whatsapp_rdo_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE,
  group_id TEXT,
  sender_phone TEXT,
  sender_name TEXT,
  status TEXT DEFAULT 'pending',
  report_id UUID REFERENCES public.reports(id),
  report_date DATE,
  error_message TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.whatsapp_group_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_rdo_logs ENABLE ROW LEVEL SECURITY;

-- Policies para whatsapp_group_projects (admin/super_admin)
CREATE POLICY "Admins can manage whatsapp mappings"
  ON public.whatsapp_group_projects FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  );

-- Service role insert for edge function
CREATE POLICY "Service can insert whatsapp mappings"
  ON public.whatsapp_group_projects FOR INSERT TO anon
  WITH CHECK (true);

-- Policies para whatsapp_rdo_logs (admin read, service write)
CREATE POLICY "Admins can read whatsapp logs"
  ON public.whatsapp_rdo_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Service can insert whatsapp logs"
  ON public.whatsapp_rdo_logs FOR ALL TO anon
  WITH CHECK (true);
