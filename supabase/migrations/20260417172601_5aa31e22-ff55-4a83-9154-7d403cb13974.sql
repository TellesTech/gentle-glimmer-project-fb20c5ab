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
  v_days_late INTEGER;
BEGIN
  IF NEW.access_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cp.id INTO v_client_id
  FROM public.client_report_access cra
  LEFT JOIN public.client_profiles cp ON LOWER(cp.email) = LOWER(cra.client_email)
  WHERE cra.id = NEW.access_id
  LIMIT 1;

  IF v_client_id IS NULL AND NEW.signer_email IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM public.client_profiles
    WHERE LOWER(email) = LOWER(NEW.signer_email)
    LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Progressive penalty rule:
  --   On time (<=7 days): 15 WEX (full reward)
  --   Late (>7 days): 15 - days_late WEX (minimum 1 WEX)
  SELECT date INTO v_report_date FROM public.reports WHERE id = NEW.report_id;
  IF v_report_date IS NOT NULL AND (CURRENT_DATE - v_report_date) > 7 THEN
    v_days_late := (CURRENT_DATE - v_report_date) - 7;
    v_coins := GREATEST(15 - v_days_late, 1);
    v_tx_type := 'late_signature_earn';
    v_description := 'RDO atrasado ' || v_days_late || ' dia(s) — ' || v_coins || ' WEX';
  ELSE
    v_coins := 15;
    v_description := 'Assinatura de RDO no prazo (+15 WEX)';
  END IF;

  v_wallet_id := public.get_or_create_wallet(v_client_id);

  UPDATE public.client_wallet
  SET balance = balance + v_coins,
      total_earned = total_earned + v_coins
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.client_wallet_transactions
    (client_id, wallet_id, type, amount, balance_after, description, report_id, signature_id)
  VALUES
    (v_client_id, v_wallet_id, v_tx_type, v_coins, v_new_balance, v_description, NEW.report_id, NEW.id);

  RETURN NEW;
END;
$function$;