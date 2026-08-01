CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.barbeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  telefone text,
  porcentagem_comissao numeric NOT NULL DEFAULT 50,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbeiros TO authenticated;
GRANT ALL ON public.barbeiros TO service_role;

ALTER TABLE public.barbeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own barbeiros"
ON public.barbeiros FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_barbeiros_updated_at
BEFORE UPDATE ON public.barbeiros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.transactions
ADD COLUMN barbeiro_id uuid REFERENCES public.barbeiros(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_barbeiro_id ON public.transactions(barbeiro_id);