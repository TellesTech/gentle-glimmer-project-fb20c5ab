-- Add progress target column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS progress_target NUMERIC DEFAULT 100;

COMMENT ON COLUMN projects.progress_target IS 'Meta de avanço do projeto em porcentagem';