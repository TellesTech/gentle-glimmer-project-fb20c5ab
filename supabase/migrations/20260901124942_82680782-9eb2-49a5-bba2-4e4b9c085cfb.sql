REVOKE EXECUTE ON FUNCTION public.get_whatsapp_runtime_config() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_runtime_config() TO service_role;