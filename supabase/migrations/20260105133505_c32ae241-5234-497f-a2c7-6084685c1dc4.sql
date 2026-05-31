-- Create bucket for project photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for public read access
CREATE POLICY "Public read project photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-photos');

-- Policy for authenticated upload
CREATE POLICY "Authenticated upload project photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-photos' AND auth.role() = 'authenticated');

-- Policy for authenticated update
CREATE POLICY "Authenticated update project photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-photos' AND auth.role() = 'authenticated');

-- Policy for authenticated delete
CREATE POLICY "Authenticated delete project photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-photos' AND auth.role() = 'authenticated');