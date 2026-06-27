
-- 1. Drop existing permissive policies
DROP POLICY IF EXISTS "Public access to clients" ON public.clients;
DROP POLICY IF EXISTS "Public access to services" ON public.services;
DROP POLICY IF EXISTS "Public access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Public access to expenses" ON public.expenses;
DROP POLICY IF EXISTS "Public access to cash_sessions" ON public.cash_sessions;
DROP POLICY IF EXISTS "Public access to settings" ON public.settings;

-- 2. Wipe legacy single-tenant data (pre-multi-tenant)
TRUNCATE public.transactions, public.cash_sessions, public.expenses, public.services, public.clients, public.settings RESTART IDENTITY CASCADE;

-- 3. Add user_id columns
ALTER TABLE public.clients       ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.services      ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.transactions  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.expenses      ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.cash_sessions ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.settings      ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Settings unique key per user
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE public.settings ADD CONSTRAINT settings_user_key_unique UNIQUE (user_id, key);
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS id uuid PRIMARY KEY DEFAULT gen_random_uuid();

-- Indexes
CREATE INDEX IF NOT EXISTS clients_user_id_idx       ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS services_user_id_idx      ON public.services(user_id);
CREATE INDEX IF NOT EXISTS transactions_user_id_idx  ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS expenses_user_id_idx      ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS cash_sessions_user_id_idx ON public.cash_sessions(user_id);

-- 5. Trigger to auto-fill user_id on insert
CREATE OR REPLACE FUNCTION public.set_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','services','transactions','expenses','cash_sessions','settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_user_id_trg ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_user_id_trg BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_user_id()', t);
  END LOOP;
END $$;

-- 6. RLS policies — each user owns their data
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','services','transactions','expenses','cash_sessions','settings']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Own rows select" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "Own rows insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "Own rows update" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "Own rows delete" ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;
