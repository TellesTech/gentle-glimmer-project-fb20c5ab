CREATE OR REPLACE FUNCTION public.credit_coins_on_signature()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id UUID;
  v_wallet_id UUID;
  v_coins INTEGER := 15;
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

  -- New rule: rewards punctuality
  --   On time (<=7 days): 15 WEX (full reward)
  --   Late (>7 days): 5 WEX (reduced reward to discourage delays)
  SELECT date INTO v_report_date FROM public.reports WHERE id = NEW.report_id;
  IF v_report_date IS NOT NULL AND (CURRENT_DATE - v_report_date) > 7 THEN
    v_coins := 5;
    v_tx_type := 'late_signature_earn';
    v_description := 'Assinatura de RDO atrasado (recompensa reduzida)';
  ELSE
    v_coins := 15;
    v_description := 'Assinatura de RDO no prazo';
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
$function$;