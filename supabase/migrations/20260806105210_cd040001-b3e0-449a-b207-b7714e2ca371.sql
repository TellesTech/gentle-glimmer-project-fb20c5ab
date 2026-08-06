-- 1. Vincular Fábio à Suzano
INSERT INTO public.user_companies (user_id, company_id)
SELECT 'a04ffcd3-4466-4962-807c-f30ae3e1fe47', '7519c290-e021-4861-94df-48e5728c98a4'
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_companies 
    WHERE user_id = 'a04ffcd3-4466-4962-807c-f30ae3e1fe47' 
    AND company_id = '7519c290-e021-4861-94df-48e5728c98a4'
);

-- 2. Limpar espaços nos nomes de perfis
UPDATE public.profiles 
SET name = TRIM(name) 
WHERE name != TRIM(name);

-- 3. Vincular Fábio aos projetos ativos da Suzano para facilitar o match
INSERT INTO public.project_members (project_id, profile_id)
SELECT id, 'a04ffcd3-4466-4962-807c-f30ae3e1fe47'
FROM public.projects
WHERE site_id IN (SELECT id FROM public.sites WHERE name ILIKE '%Suzano%')
ON CONFLICT DO NOTHING;