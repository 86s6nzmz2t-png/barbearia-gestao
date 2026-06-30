
CREATE TABLE public.cash_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('in','out')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX cash_movements_user_id_idx ON public.cash_movements(user_id);
CREATE INDEX cash_movements_date_idx ON public.cash_movements(date DESC);
CREATE INDEX cash_movements_session_idx ON public.cash_movements(cash_session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own rows select" ON public.cash_movements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own rows insert" ON public.cash_movements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own rows update" ON public.cash_movements FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own rows delete" ON public.cash_movements FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_user_id_trg BEFORE INSERT ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
