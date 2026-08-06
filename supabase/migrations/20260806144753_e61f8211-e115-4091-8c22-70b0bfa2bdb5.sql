ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_day integer;

CREATE OR REPLACE FUNCTION public.tg_expenses_validate_recurrence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.recurring THEN
    IF NEW.recurrence_day IS NULL THEN
      NEW.recurrence_day := EXTRACT(DAY FROM NEW.due_date)::int;
    END IF;
    IF NEW.recurrence_day < 1 OR NEW.recurrence_day > 31 THEN
      RAISE EXCEPTION 'recurrence_day deve estar entre 1 e 31';
    END IF;
  ELSE
    NEW.recurrence_day := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expenses_validate_recurrence ON public.expenses;
CREATE TRIGGER expenses_validate_recurrence
BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.tg_expenses_validate_recurrence();