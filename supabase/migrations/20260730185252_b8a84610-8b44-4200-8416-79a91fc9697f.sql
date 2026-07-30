CREATE TABLE IF NOT EXISTS public.rdo_legacy_backup (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid NOT NULL,
  report_id uuid NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  field text NOT NULL,
  value_before jsonb,
  value_after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rdo_legacy_backup_batch_idx ON public.rdo_legacy_backup(batch_id);
CREATE INDEX IF NOT EXISTS rdo_legacy_backup_report_idx ON public.rdo_legacy_backup(report_id);

GRANT ALL ON public.rdo_legacy_backup TO service_role;
GRANT SELECT ON public.rdo_legacy_backup TO authenticated;

ALTER TABLE public.rdo_legacy_backup ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rdo_legacy_backup' AND policyname='Admins can view rdo legacy backup') THEN
    CREATE POLICY "Admins can view rdo legacy backup" ON public.rdo_legacy_backup
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
  END IF;
END $$;