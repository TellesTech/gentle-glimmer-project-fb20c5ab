NOTIFY pgrst, 'reload schema';

-- Re-grant permissions just in case
GRANT ALL ON public.site_responsibles TO authenticated, service_role;
GRANT ALL ON public.profiles TO authenticated, service_role;
GRANT ALL ON public.user_roles TO authenticated, service_role;
