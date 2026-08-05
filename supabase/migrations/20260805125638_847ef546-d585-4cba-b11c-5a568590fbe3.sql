DROP POLICY IF EXISTS "admins select all" ON public.profiles;
DROP POLICY IF EXISTS "admins update all" ON public.profiles;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;