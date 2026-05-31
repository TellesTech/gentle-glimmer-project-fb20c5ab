DROP FUNCTION IF EXISTS public.get_company_public_info(uuid);

CREATE OR REPLACE FUNCTION public.get_company_public_info(p_company_id uuid)
RETURNS TABLE (id uuid, name text, logo_url text, photo_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.logo_url, c.photo_url
  FROM public.companies c
  WHERE c.id = p_company_id;
END;
$$;