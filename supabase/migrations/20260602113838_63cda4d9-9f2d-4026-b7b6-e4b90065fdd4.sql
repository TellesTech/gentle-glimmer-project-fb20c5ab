-- Recriar políticas de storage para o bucket company-photos
DROP POLICY IF EXISTS "Public read company photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload company photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins update company photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete company photos" ON storage.objects;

CREATE POLICY "Public read company photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-photos');

CREATE POLICY "Authenticated upload company photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-photos');

CREATE POLICY "Authenticated update company photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-photos')
  WITH CHECK (bucket_id = 'company-photos');

CREATE POLICY "Authenticated delete company photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-photos');