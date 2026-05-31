-- Adicionar coluna para URL do screenshot nas sugestões
ALTER TABLE public.feature_suggestions 
ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

-- Criar bucket para screenshots de sugestões (público para visualização)
INSERT INTO storage.buckets (id, name, public)
VALUES ('suggestion-screenshots', 'suggestion-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Política: usuários autenticados podem fazer upload
CREATE POLICY "Authenticated users can upload suggestion screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'suggestion-screenshots');

-- Política: todos podem visualizar screenshots
CREATE POLICY "Anyone can view suggestion screenshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'suggestion-screenshots');

-- Política: usuários podem deletar seus próprios uploads
CREATE POLICY "Users can delete own suggestion screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'suggestion-screenshots');