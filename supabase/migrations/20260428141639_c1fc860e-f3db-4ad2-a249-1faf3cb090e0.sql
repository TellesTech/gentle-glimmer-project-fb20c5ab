-- =========================================================================
-- 1) Function: sync reports.status from autentique_documents.status
-- =========================================================================
CREATE OR REPLACE FUNCTION public.sync_report_status_from_autentique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other_active INTEGER;
BEGIN
  IF NEW.report_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Document SIGNED -> mark report as signed (unless already in a terminal state)
  IF NEW.status = 'signed' THEN
    UPDATE public.reports
       SET status = 'signed'
     WHERE id = NEW.report_id
       AND status IN ('draft', 'completed', 'sent');
    RETURN NEW;
  END IF;

  -- Document PENDING -> ensure report is at least 'sent'
  IF NEW.status = 'pending' THEN
    UPDATE public.reports
       SET status  = 'sent',
           sent_at = COALESCE(sent_at, NEW.created_at, now())
     WHERE id = NEW.report_id
       AND status IN ('draft', 'completed');
    RETURN NEW;
  END IF;

  -- Document CANCELLED -> if no other active doc exists, demote back to 'completed'
  IF NEW.status = 'cancelled' THEN
    SELECT COUNT(*) INTO v_other_active
      FROM public.autentique_documents
     WHERE report_id = NEW.report_id
       AND id <> NEW.id
       AND status IN ('pending', 'signed');

    IF v_other_active = 0 THEN
      UPDATE public.reports
         SET status = 'completed'
       WHERE id = NEW.report_id
         AND status = 'sent';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- =========================================================================
-- 2) Trigger on autentique_documents
-- =========================================================================
DROP TRIGGER IF EXISTS trg_sync_report_status_from_autentique ON public.autentique_documents;

CREATE TRIGGER trg_sync_report_status_from_autentique
AFTER INSERT OR UPDATE OF status ON public.autentique_documents
FOR EACH ROW
EXECUTE FUNCTION public.sync_report_status_from_autentique();

-- =========================================================================
-- 3) One-time backfill: bring legacy reports in sync with autentique state
-- =========================================================================

-- 3a) Reports whose latest Autentique doc is 'signed' -> mark as signed
WITH latest AS (
  SELECT DISTINCT ON (report_id)
    report_id, status, created_at
  FROM public.autentique_documents
  WHERE report_id IS NOT NULL
  ORDER BY report_id, created_at DESC
)
UPDATE public.reports r
   SET status = 'signed'
  FROM latest l
 WHERE l.report_id = r.id
   AND l.status = 'signed'
   AND r.status IN ('draft', 'completed', 'sent');

-- 3b) Reports whose latest Autentique doc is 'pending' but report is still 'completed'/'draft'
WITH latest AS (
  SELECT DISTINCT ON (report_id)
    report_id, status, created_at
  FROM public.autentique_documents
  WHERE report_id IS NOT NULL
  ORDER BY report_id, created_at DESC
)
UPDATE public.reports r
   SET status  = 'sent',
       sent_at = COALESCE(r.sent_at, l.created_at)
  FROM latest l
 WHERE l.report_id = r.id
   AND l.status = 'pending'
   AND r.status IN ('completed', 'draft');

-- 3c) Reports whose latest Autentique doc is 'cancelled' and have NO active sibling
WITH latest AS (
  SELECT DISTINCT ON (report_id)
    report_id, id AS doc_id, status, created_at
  FROM public.autentique_documents
  WHERE report_id IS NOT NULL
  ORDER BY report_id, created_at DESC
),
no_active_sibling AS (
  SELECT l.report_id
    FROM latest l
   WHERE l.status = 'cancelled'
     AND NOT EXISTS (
       SELECT 1 FROM public.autentique_documents ad
        WHERE ad.report_id = l.report_id
          AND ad.id <> l.doc_id
          AND ad.status IN ('pending', 'signed')
     )
)
UPDATE public.reports r
   SET status = 'completed'
  FROM no_active_sibling n
 WHERE n.report_id = r.id
   AND r.status = 'sent';
