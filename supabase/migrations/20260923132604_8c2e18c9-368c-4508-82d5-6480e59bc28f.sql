CREATE TABLE public.report_photo_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL,
  report_id uuid,
  url text NOT NULL,
  description text,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.report_photo_deletions TO authenticated;
GRANT ALL ON public.report_photo_deletions TO service_role;

ALTER TABLE public.report_photo_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view photo deletions"
ON public.report_photo_deletions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE INDEX idx_report_photo_deletions_report ON public.report_photo_deletions(report_id);
CREATE INDEX idx_report_photo_deletions_deleted_at ON public.report_photo_deletions(deleted_at DESC);

CREATE OR REPLACE FUNCTION public.log_report_photo_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.report_photo_deletions (photo_id, report_id, url, description, deleted_by)
  VALUES (OLD.id, OLD.report_id, OLD.url, OLD.description, auth.uid());
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_log_report_photo_deletion
AFTER DELETE ON public.report_photos
FOR EACH ROW EXECUTE FUNCTION public.log_report_photo_deletion();