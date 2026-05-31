-- Tornar o bucket admin-exports público para que as URLs funcionem
UPDATE storage.buckets SET public = true WHERE name = 'admin-exports';

-- Adicionar política para permitir upload por usuários autenticados
CREATE POLICY "Authenticated users can upload exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'admin-exports');

-- Adicionar política para permitir leitura pública (já que o bucket será público)
CREATE POLICY "Public read access for admin-exports"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'admin-exports');