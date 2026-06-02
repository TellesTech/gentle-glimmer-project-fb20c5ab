DROP POLICY IF EXISTS "Anyone can view service report photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload service report photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update service report photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete service report photos" ON storage.objects;

CREATE POLICY "Anyone can view service report photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'service-report-photos');

CREATE POLICY "Authenticated users can upload service report photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-report-photos');

CREATE POLICY "Authenticated users can update service report photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'service-report-photos')
WITH CHECK (bucket_id = 'service-report-photos');

CREATE POLICY "Authenticated users can delete service report photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'service-report-photos');