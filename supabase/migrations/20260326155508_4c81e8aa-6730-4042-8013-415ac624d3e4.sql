CREATE OR REPLACE FUNCTION public.get_eligible_supervisors()
 RETURNS TABLE(id uuid, name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.id, p.name
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('admin', 'super_admin')
  ORDER BY p.name;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'super_admin' THEN 0
      WHEN 'admin' THEN 1 
      ELSE 2 
    END
  LIMIT 1
$function$;