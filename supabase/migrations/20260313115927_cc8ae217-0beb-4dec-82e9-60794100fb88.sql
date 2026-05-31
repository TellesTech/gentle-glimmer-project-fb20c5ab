
ALTER TABLE public.whatsapp_group_projects ADD COLUMN site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_group_projects DROP COLUMN IF EXISTS project_id;
