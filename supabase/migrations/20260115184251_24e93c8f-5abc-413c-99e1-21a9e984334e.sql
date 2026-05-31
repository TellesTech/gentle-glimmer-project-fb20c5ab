-- Ensure storage.objects has policies that allow creating and downloading batch exports
-- Note: policies live on storage.objects and are required even for public buckets.

DO $$
BEGIN
  -- Public read for admin-exports (needed for getPublicUrl links to work without auth headers)
  BEGIN
    CREATE POLICY "Public read admin-exports"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'admin-exports');
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- Allow authenticated users to upload/export files to admin-exports
  BEGIN
    CREATE POLICY "Authenticated upload admin-exports"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'admin-exports' AND auth.role() = 'authenticated');
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- Allow authenticated users to update (needed for upsert=true)
  BEGIN
    CREATE POLICY "Authenticated update admin-exports"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'admin-exports' AND auth.role() = 'authenticated')
    WITH CHECK (bucket_id = 'admin-exports' AND auth.role() = 'authenticated');
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
