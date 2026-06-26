
-- Serviços
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to services" ON public.services FOR ALL USING (true) WITH CHECK (true);

-- Despesas fixas
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO anon, authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

-- Configurações (chave/valor)
CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.settings (key, value) VALUES ('default_card_fee', '3') ON CONFLICT DO NOTHING;

-- Sessões de caixa
CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  date date NOT NULL DEFAULT CURRENT_DATE,
  opening_amount numeric NOT NULL DEFAULT 0,
  counted_amount numeric,
  difference numeric,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sessions TO anon, authenticated;
GRANT ALL ON public.cash_sessions TO service_role;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to cash_sessions" ON public.cash_sessions FOR ALL USING (true) WITH CHECK (true);

-- Vínculo opcional de transação à sessão de caixa
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL;

-- Seed alguns serviços de exemplo
INSERT INTO public.services (name, price) VALUES
  ('Cabelo', 35),
  ('Barba', 25),
  ('Combo (Cabelo + Barba)', 55)
ON CONFLICT DO NOTHING;
