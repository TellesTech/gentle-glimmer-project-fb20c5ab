
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_responsibles TO authenticated;
GRANT ALL ON public.site_responsibles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_admin_access TO authenticated;
GRANT ALL ON public.portal_admin_access TO service_role;
