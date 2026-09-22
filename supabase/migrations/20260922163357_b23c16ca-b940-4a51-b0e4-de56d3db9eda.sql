DELETE FROM public.report_signatures older
USING public.report_signatures newer
WHERE older.report_id = newer.report_id
  AND older.signer_user_id IS NOT NULL
  AND older.signer_user_id = newer.signer_user_id
  AND (older.signed_at, older.id) < (newer.signed_at, newer.id);

DELETE FROM public.report_signatures older
USING public.report_signatures newer
WHERE older.report_id = newer.report_id
  AND older.signer_user_id IS NULL
  AND newer.signer_user_id IS NULL
  AND older.signer_email IS NOT NULL
  AND newer.signer_email IS NOT NULL
  AND lower(trim(older.signer_email)) = lower(trim(newer.signer_email))
  AND (older.signed_at, older.id) < (newer.signed_at, newer.id);

DELETE FROM public.report_signatures older
USING public.report_signatures newer
WHERE older.report_id = newer.report_id
  AND older.signer_user_id IS NULL
  AND newer.signer_user_id IS NULL
  AND older.signer_email IS NULL
  AND newer.signer_email IS NULL
  AND older.access_id IS NOT NULL
  AND older.access_id = newer.access_id
  AND (older.signed_at, older.id) < (newer.signed_at, newer.id);

CREATE UNIQUE INDEX report_signatures_unique_report_user
  ON public.report_signatures (report_id, signer_user_id)
  WHERE signer_user_id IS NOT NULL;

CREATE UNIQUE INDEX report_signatures_unique_report_email
  ON public.report_signatures (report_id, lower(trim(signer_email)))
  WHERE signer_user_id IS NULL AND signer_email IS NOT NULL;

CREATE UNIQUE INDEX report_signatures_unique_report_access
  ON public.report_signatures (report_id, access_id)
  WHERE signer_user_id IS NULL AND signer_email IS NULL AND access_id IS NOT NULL;