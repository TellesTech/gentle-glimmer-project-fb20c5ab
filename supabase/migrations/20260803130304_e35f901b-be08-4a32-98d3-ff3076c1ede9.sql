-- Mensagens enviadas a clientes (histórico e edição)
CREATE TABLE public.client_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'whatsapp',
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  company_id uuid,
  site_id uuid,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  provider_message_id text,
  sent_at timestamptz DEFAULT now(),
  created_by uuid,
  edited_at timestamptz,
  edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_messages TO authenticated;
GRANT ALL ON public.client_messages TO service_role;

ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view client messages"
ON public.client_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can insert client messages"
ON public.client_messages FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update client messages"
ON public.client_messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete client messages"
ON public.client_messages FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Histórico de edições
CREATE TABLE public.client_message_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.client_messages(id) ON DELETE CASCADE,
  previous_content text NOT NULL,
  new_content text NOT NULL,
  edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.client_message_edits TO authenticated;
GRANT ALL ON public.client_message_edits TO service_role;

ALTER TABLE public.client_message_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view message edits"
ON public.client_message_edits FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can insert message edits"
ON public.client_message_edits FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_client_messages_sent_at ON public.client_messages (sent_at DESC);
CREATE INDEX idx_client_message_edits_message ON public.client_message_edits (message_id, created_at DESC);

-- Trigger de updated_at + registro automático de edição
CREATE OR REPLACE FUNCTION public.tg_client_messages_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.edited_at = now();
    NEW.edited_by = COALESCE(NEW.edited_by, auth.uid());
    INSERT INTO public.client_message_edits (message_id, previous_content, new_content, edited_by)
    VALUES (OLD.id, OLD.content, NEW.content, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_messages_update
BEFORE UPDATE ON public.client_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_client_messages_update();