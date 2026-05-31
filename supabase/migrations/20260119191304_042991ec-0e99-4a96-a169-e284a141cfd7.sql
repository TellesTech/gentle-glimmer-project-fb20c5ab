-- Add total_quantity and unit columns to project_stages table
ALTER TABLE project_stages 
ADD COLUMN IF NOT EXISTS total_quantity NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT NULL;