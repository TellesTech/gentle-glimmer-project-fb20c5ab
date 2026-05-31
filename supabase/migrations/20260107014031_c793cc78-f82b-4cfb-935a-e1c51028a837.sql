-- Remover a política atual restritiva
DROP POLICY IF EXISTS "Users can view company profiles" ON profiles;

-- Criar nova política que permite todos autenticados visualizarem profiles para atribuições
CREATE POLICY "Users can view profiles for assignments"
ON profiles FOR SELECT
TO authenticated
USING (true);