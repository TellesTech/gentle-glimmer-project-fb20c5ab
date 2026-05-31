
-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE public.wallet_transaction_type AS ENUM ('signature_earn', 'late_signature_earn', 'redemption_spend', 'admin_adjustment', 'refund');
CREATE TYPE public.reward_category AS ENUM ('physical', 'voucher', 'service_discount', 'donation');
CREATE TYPE public.redemption_status AS ENUM ('pending', 'approved', 'delivered', 'cancelled');

-- ============================================
-- TABLE: client_wallet
-- ============================================
CREATE TABLE public.client_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT balance_non_negative CHECK (balance >= 0)
);

ALTER TABLE public.client_wallet ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_client_wallet_client ON public.client_wallet(client_id);

-- ============================================
-- TABLE: client_wallet_transactions
-- ============================================
CREATE TABLE public.client_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  wallet_id UUID NOT NULL REFERENCES public.client_wallet(id) ON DELETE CASCADE,
  type public.wallet_transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  signature_id UUID,
  redemption_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_wallet_tx_client ON public.client_wallet_transactions(client_id);
CREATE INDEX idx_wallet_tx_wallet ON public.client_wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_tx_created ON public.client_wallet_transactions(created_at DESC);

-- ============================================
-- TABLE: rewards_catalog
-- ============================================
CREATE TABLE public.rewards_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category public.reward_category NOT NULL DEFAULT 'physical',
  cost INTEGER NOT NULL CHECK (cost > 0),
  stock INTEGER, -- NULL = ilimitado
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rewards_catalog ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_rewards_active ON public.rewards_catalog(is_active, order_index);

-- ============================================
-- TABLE: reward_redemptions
-- ============================================
CREATE TABLE public.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  reward_id UUID NOT NULL REFERENCES public.rewards_catalog(id) ON DELETE RESTRICT,
  reward_name_snapshot TEXT NOT NULL,
  cost INTEGER NOT NULL,
  status public.redemption_status NOT NULL DEFAULT 'pending',
  delivery_address TEXT,
  delivery_notes TEXT,
  admin_notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_redemptions_client ON public.reward_redemptions(client_id);
CREATE INDEX idx_redemptions_status ON public.reward_redemptions(status, created_at DESC);

-- ============================================
-- TIMESTAMP TRIGGERS
-- ============================================
CREATE TRIGGER update_client_wallet_updated_at
  BEFORE UPDATE ON public.client_wallet
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rewards_catalog_updated_at
  BEFORE UPDATE ON public.rewards_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reward_redemptions_updated_at
  BEFORE UPDATE ON public.reward_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- HELPER: get or create wallet
-- ============================================
CREATE OR REPLACE FUNCTION public.get_or_create_wallet(_client_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id FROM public.client_wallet WHERE client_id = _client_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.client_wallet (client_id) VALUES (_client_id) RETURNING id INTO v_wallet_id;
  END IF;
  RETURN v_wallet_id;
END;
$$;

-- ============================================
-- TRIGGER: credit coins on signature
-- Awards 10 coins per signature, 15 if RDO is >7 days old
-- ============================================
CREATE OR REPLACE FUNCTION public.credit_coins_on_signature()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_wallet_id UUID;
  v_coins INTEGER := 10;
  v_tx_type public.wallet_transaction_type := 'signature_earn';
  v_report_date DATE;
  v_new_balance INTEGER;
  v_description TEXT;
BEGIN
  -- Only credit signatures linked to a client (via access_id → client_report_access)
  IF NEW.access_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve client_id from the access record's email → client_profiles
  SELECT cp.id INTO v_client_id
  FROM public.client_report_access cra
  LEFT JOIN public.client_profiles cp ON LOWER(cp.email) = LOWER(cra.client_email)
  WHERE cra.id = NEW.access_id
  LIMIT 1;

  -- Fallback: try via signer_email
  IF v_client_id IS NULL AND NEW.signer_email IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM public.client_profiles
    WHERE LOWER(email) = LOWER(NEW.signer_email)
    LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check report age for "late" bonus
  SELECT date INTO v_report_date FROM public.reports WHERE id = NEW.report_id;
  IF v_report_date IS NOT NULL AND (CURRENT_DATE - v_report_date) > 7 THEN
    v_coins := 15;
    v_tx_type := 'late_signature_earn';
    v_description := 'Assinatura de RDO atrasado (+5 bônus)';
  ELSE
    v_description := 'Assinatura de RDO';
  END IF;

  v_wallet_id := public.get_or_create_wallet(v_client_id);

  -- Credit
  UPDATE public.client_wallet
  SET balance = balance + v_coins,
      total_earned = total_earned + v_coins
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  -- Log transaction
  INSERT INTO public.client_wallet_transactions
    (client_id, wallet_id, type, amount, balance_after, description, report_id, signature_id)
  VALUES
    (v_client_id, v_wallet_id, v_tx_type, v_coins, v_new_balance, v_description, NEW.report_id, NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_coins_on_signature
  AFTER INSERT ON public.report_signatures
  FOR EACH ROW EXECUTE FUNCTION public.credit_coins_on_signature();

-- ============================================
-- RPC: redeem_reward
-- ============================================
CREATE OR REPLACE FUNCTION public.redeem_reward(
  _client_id UUID,
  _reward_id UUID,
  _delivery_address TEXT DEFAULT NULL,
  _delivery_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward RECORD;
  v_wallet_id UUID;
  v_balance INTEGER;
  v_redemption_id UUID;
  v_new_balance INTEGER;
BEGIN
  -- Lock reward and validate
  SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = _reward_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recompensa não encontrada ou inativa';
  END IF;

  IF v_reward.stock IS NOT NULL AND v_reward.stock <= 0 THEN
    RAISE EXCEPTION 'Recompensa esgotada';
  END IF;

  -- Lock wallet
  v_wallet_id := public.get_or_create_wallet(_client_id);
  SELECT balance INTO v_balance FROM public.client_wallet WHERE id = v_wallet_id FOR UPDATE;

  IF v_balance < v_reward.cost THEN
    RAISE EXCEPTION 'Saldo insuficiente. Necessário: %, disponível: %', v_reward.cost, v_balance;
  END IF;

  -- Create redemption
  INSERT INTO public.reward_redemptions
    (client_id, reward_id, reward_name_snapshot, cost, delivery_address, delivery_notes)
  VALUES
    (_client_id, _reward_id, v_reward.name, v_reward.cost, _delivery_address, _delivery_notes)
  RETURNING id INTO v_redemption_id;

  -- Debit wallet
  UPDATE public.client_wallet
  SET balance = balance - v_reward.cost,
      total_spent = total_spent + v_reward.cost
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  -- Decrement stock
  IF v_reward.stock IS NOT NULL THEN
    UPDATE public.rewards_catalog SET stock = stock - 1 WHERE id = _reward_id;
  END IF;

  -- Log transaction
  INSERT INTO public.client_wallet_transactions
    (client_id, wallet_id, type, amount, balance_after, description, redemption_id)
  VALUES
    (_client_id, v_wallet_id, 'redemption_spend', -v_reward.cost, v_new_balance,
     'Resgate: ' || v_reward.name, v_redemption_id);

  RETURN v_redemption_id;
END;
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- client_wallet
CREATE POLICY "Clients view own wallet"
  ON public.client_wallet FOR SELECT
  USING (client_id = public.get_client_profile_id(auth.uid()));

CREATE POLICY "Admins view all wallets"
  ON public.client_wallet FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "System manages wallets"
  ON public.client_wallet FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- client_wallet_transactions
CREATE POLICY "Clients view own transactions"
  ON public.client_wallet_transactions FOR SELECT
  USING (client_id = public.get_client_profile_id(auth.uid()));

CREATE POLICY "Admins view all transactions"
  ON public.client_wallet_transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- rewards_catalog
CREATE POLICY "Anyone authenticated can view active rewards"
  ON public.rewards_catalog FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins manage rewards catalog"
  ON public.rewards_catalog FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- reward_redemptions
CREATE POLICY "Clients view own redemptions"
  ON public.reward_redemptions FOR SELECT
  USING (client_id = public.get_client_profile_id(auth.uid()));

CREATE POLICY "Admins view all redemptions"
  ON public.reward_redemptions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins update redemptions"
  ON public.reward_redemptions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- ============================================
-- SEED initial catalog
-- ============================================
INSERT INTO public.rewards_catalog (name, description, category, cost, stock, order_index) VALUES
  ('Caneca WEES', 'Caneca de cerâmica personalizada com o logo WEES.', 'physical', 200, 50, 1),
  ('Camiseta WEES', 'Camiseta 100% algodão com bordado WEES.', 'physical', 500, 30, 2),
  ('Kit Escritório WEES', 'Caneta, bloco e adesivos WEES.', 'physical', 800, 20, 3),
  ('Mochila Executiva WEES', 'Mochila para notebook com compartimento térmico.', 'physical', 1500, 10, 4),
  ('Doação - Instituto Ronald McDonald', 'Suas moedas viram doação para crianças com câncer.', 'donation', 100, NULL, 10),
  ('Doação - SOS Mata Atlântica', 'Plante árvores nativas em seu nome.', 'donation', 150, NULL, 11),
  ('Doação - Médicos Sem Fronteiras', 'Apoio à ajuda humanitária internacional.', 'donation', 200, NULL, 12);
