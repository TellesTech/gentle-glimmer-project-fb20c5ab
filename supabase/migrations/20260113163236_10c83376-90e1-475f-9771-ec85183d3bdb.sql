-- Add no_activity column to reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS no_activity BOOLEAN DEFAULT false;