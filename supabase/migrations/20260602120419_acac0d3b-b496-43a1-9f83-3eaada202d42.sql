ALTER TABLE public.whatsapp_group_projects
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  ALTER COLUMN project_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wgp_site_id ON public.whatsapp_group_projects(site_id);