CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role text := 'barbeiro';
  _status text := 'pendente';
BEGIN
  IF lower(NEW.email) = 'loshermanosbarbearia.mga@gmail.com' THEN
    _role := 'admin';
    _status := 'aprovado';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    _role,
    _status
  )
  ON CONFLICT (id) DO UPDATE
    SET role = CASE WHEN lower(EXCLUDED.email) = 'loshermanosbarbearia.mga@gmail.com' THEN 'admin' ELSE public.profiles.role END,
        status = CASE WHEN lower(EXCLUDED.email) = 'loshermanosbarbearia.mga@gmail.com' THEN 'aprovado' ELSE public.profiles.status END;
  RETURN NEW;
END;
$function$;

UPDATE public.profiles
SET role = 'admin', status = 'aprovado'
WHERE lower(email) = 'loshermanosbarbearia.mga@gmail.com';