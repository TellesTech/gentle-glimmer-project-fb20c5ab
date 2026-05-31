
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  last_used_at timestamptz,
  last_used_ip text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin manage api_keys"
  ON public.api_keys FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::user_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::user_role));

CREATE TRIGGER trg_api_keys_updated
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_api_key(_key text, _ip text DEFAULT NULL)
RETURNS TABLE(id uuid, scopes text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_id uuid;
  v_scopes text[];
BEGIN
  v_hash := encode(digest(_key, 'sha256'), 'hex');

  SELECT k.id, k.scopes INTO v_id, v_scopes
  FROM public.api_keys k
  WHERE k.key_hash = v_hash
    AND k.revoked_at IS NULL
    AND (k.expires_at IS NULL OR k.expires_at > now())
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.api_keys
     SET last_used_at = now(), last_used_ip = _ip
   WHERE api_keys.id = v_id;

  RETURN QUERY SELECT v_id, v_scopes;
END;
$$;
