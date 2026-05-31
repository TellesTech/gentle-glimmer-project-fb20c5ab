-- Add order_index column to team_members table for drag and drop reordering
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;

-- Create index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_team_members_order ON public.team_members (team_id, order_index);