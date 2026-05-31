
CREATE TABLE public.client_portal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  welcome_title text DEFAULT 'Bem-vindo ao Portal',
  welcome_subtitle text DEFAULT 'Acompanhe seus relatórios e aprovações',
  client_logo_url text,
  client_primary_color text DEFAULT '#991919',
  client_accent_color text DEFAULT '#1e1e1e',
  show_stats_cards boolean DEFAULT true,
  show_approval_rate boolean DEFAULT true,
  show_rejection_stats boolean DEFAULT true,
  show_autentique_widget boolean DEFAULT true,
  show_supersign_alert boolean DEFAULT true,
  show_project_filter boolean DEFAULT true,
  dashboard_title text DEFAULT 'Dashboard',
  reports_title text DEFAULT 'Relatórios',
  signatures_title text DEFAULT 'Assinaturas',
  profile_title text DEFAULT 'Meu Perfil',
  pending_message text DEFAULT '{count} relatório(s) aguardando aprovação.',
  all_clear_message text DEFAULT 'Todos os relatórios estão em dia.',
  no_signature_alert_title text DEFAULT 'SuperSign não configurada',
  no_signature_alert_message text DEFAULT 'Configure sua assinatura digital para aprovar relatórios.',
  support_email text,
  support_phone text,
  footer_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_portal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage client portal settings"
  ON public.client_portal_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Authenticated users can view client portal settings"
  ON public.client_portal_settings FOR SELECT TO authenticated
  USING (true);

-- Insert default row
INSERT INTO public.client_portal_settings (id) VALUES (gen_random_uuid());
