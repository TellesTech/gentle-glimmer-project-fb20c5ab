-- Add progress column to projects table for manual progress tracking
ALTER TABLE projects ADD COLUMN progress numeric DEFAULT 0;