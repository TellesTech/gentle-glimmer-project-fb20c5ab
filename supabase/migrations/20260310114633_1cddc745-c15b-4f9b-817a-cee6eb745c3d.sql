
-- RPC pública para listar sites de uma empresa
CREATE OR REPLACE FUNCTION public.get_company_sites(p_company_id uuid)
RETURNS TABLE (id uuid, name text, city text, state text, photo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.name, s.city, s.state, s.photo_url
  FROM public.sites s
  WHERE s.company_id = p_company_id
  ORDER BY s.name;
$$;

-- Atualizar RPC de contatos para filtrar por site
CREATE OR REPLACE FUNCTION public.get_company_login_contacts(p_company_id uuid, p_site_id uuid DEFAULT NULL)
RETURNS TABLE (id uuid, name text, email text, role text, avatar_url text, has_pin boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cc.id, cc.name, cc.email, cc.role, cc.avatar_url,
         (cc.pin_hash IS NOT NULL AND cc.pin_hash != '') AS has_pin
  FROM public.company_contacts cc
  WHERE cc.company_id = p_company_id 
    AND cc.is_active = true
    AND cc.user_id IS NOT NULL
    AND (p_site_id IS NULL OR cc.id IN (
      SELECT cs.contact_id FROM public.contact_sites cs WHERE cs.site_id = p_site_id
    ));
$$;
