-- Tabela de documentos do Autentique
CREATE TABLE public.autentique_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  document_id VARCHAR NOT NULL,
  document_name VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES public.profiles(id),
  sandbox BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Tabela de signatários do Autentique
CREATE TABLE public.autentique_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.autentique_documents(id) ON DELETE CASCADE,
  signer_id VARCHAR,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  phone VARCHAR,
  action VARCHAR DEFAULT 'sign',
  status VARCHAR NOT NULL DEFAULT 'pending',
  sign_link TEXT,
  signed_at TIMESTAMPTZ,
  ip_address VARCHAR,
  user_agent TEXT,
  geolocation JSONB,
  client_id UUID REFERENCES public.client_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de webhooks do Autentique
CREATE TABLE public.autentique_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR NOT NULL,
  document_id VARCHAR,
  signer_id VARCHAR,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.autentique_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autentique_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autentique_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS policies for autentique_documents
CREATE POLICY "Admins can manage documents" ON public.autentique_documents
  FOR ALL USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'director') OR 
    has_role(auth.uid(), 'supervisor') OR
    has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Report owners and admins can view documents" ON public.autentique_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reports r
      WHERE r.id = autentique_documents.report_id
      AND (
        r.created_by = auth.uid() OR
        has_role(auth.uid(), 'admin') OR
        has_role(auth.uid(), 'director') OR
        has_role(auth.uid(), 'supervisor') OR
        has_role(auth.uid(), 'super_admin')
      )
    )
  );

-- RLS policies for autentique_signers
CREATE POLICY "Admins can manage signers" ON public.autentique_signers
  FOR ALL USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'director') OR 
    has_role(auth.uid(), 'supervisor') OR
    has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Signers and admins can view signer info" ON public.autentique_signers
  FOR SELECT USING (
    client_id = get_client_profile_id(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM autentique_documents d
      JOIN reports r ON r.id = d.report_id
      WHERE d.id = autentique_signers.document_id
      AND (
        r.created_by = auth.uid() OR
        has_role(auth.uid(), 'admin') OR
        has_role(auth.uid(), 'director') OR
        has_role(auth.uid(), 'supervisor') OR
        has_role(auth.uid(), 'super_admin')
      )
    )
  );

-- RLS policies for autentique_webhooks
CREATE POLICY "Super admins can manage webhooks" ON public.autentique_webhooks
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can view webhooks" ON public.autentique_webhooks
  FOR SELECT USING (has_role(auth.uid(), 'super_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_autentique_documents_updated_at
  BEFORE UPDATE ON public.autentique_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_autentique_signers_updated_at
  BEFORE UPDATE ON public.autentique_signers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();