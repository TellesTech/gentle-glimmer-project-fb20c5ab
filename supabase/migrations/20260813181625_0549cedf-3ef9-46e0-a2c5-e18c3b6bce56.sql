DO $$
DECLARE
  repaired_signature text := 'DATA_PLACEHOLDER';
  legacy_signature text;
BEGIN
  SELECT signature_data INTO legacy_signature
  FROM public.profiles
  WHERE id = 'c7e57fcf-ea73-4a53-9aa1-d5c676f73902';

  IF legacy_signature IS NULL OR length(legacy_signature) <> 16062 THEN
    RAISE EXCEPTION 'Assinatura legada esperada não foi encontrada; nenhuma alteração aplicada';
  END IF;

  UPDATE public.profiles
  SET signature_data = repaired_signature,
      updated_at = now()
  WHERE id = 'c7e57fcf-ea73-4a53-9aa1-d5c676f73902'
    AND signature_data = legacy_signature;

  UPDATE public.report_signatures
  SET signature_data = repaired_signature
  WHERE unaccent(lower(trim(signer_name))) = unaccent(lower('Ricardo Gabriel Barcelos'))
    AND signature_data = legacy_signature;
END $$;