-- Bucket temporário privado para upload de ZIPs de restauração
INSERT INTO storage.buckets (id, name, public)
VALUES ('temp-backups', 'temp-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Permitir que admins/super_admins/directors gerenciem seus próprios arquivos temporários
DROP POLICY IF EXISTS "Admins can upload temp backups" ON storage.objects;
CREATE POLICY "Admins can upload temp backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'temp-backups'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'director')
    OR public.is_super_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can read temp backups" ON storage.objects;
CREATE POLICY "Admins can read temp backups"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'temp-backups'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'director')
    OR public.is_super_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can delete temp backups" ON storage.objects;
CREATE POLICY "Admins can delete temp backups"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'temp-backups'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'director')
    OR public.is_super_admin(auth.uid())
  )
);