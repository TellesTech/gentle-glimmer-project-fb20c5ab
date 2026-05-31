-- Garante permissões para o service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Recarrega o cache
NOTIFY pgrst, 'reload schema';

-- Cadastra a empresa WEES Soluções apenas se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE name = 'WEES Soluções') THEN
        INSERT INTO public.companies (name, email)
        VALUES ('WEES Soluções', 'contato@wees.com.br');
    END IF;
END $$;
