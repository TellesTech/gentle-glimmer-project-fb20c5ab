CREATE POLICY "Authenticated can read public buckets"
ON storage.buckets
FOR SELECT
TO authenticated
USING (id IN ('service-report-photos', 'avatars', 'company-photos'));