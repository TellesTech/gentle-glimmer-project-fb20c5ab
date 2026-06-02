ALTER TABLE public.portal_admin_access DROP CONSTRAINT IF EXISTS portal_admin_access_user_id_key;
ALTER TABLE public.portal_admin_access DROP CONSTRAINT IF EXISTS portal_admin_access_user_id_site_id_key;
ALTER TABLE public.portal_admin_access ADD CONSTRAINT portal_admin_access_user_id_site_id_key UNIQUE (user_id, site_id);