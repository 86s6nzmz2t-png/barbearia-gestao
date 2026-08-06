import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export type Service = { id: string; name: string; price: number };
export type Expense = {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  recurring: boolean;
  recurrence_day: number | null;
};
export type CashSession = {
  id: string;
  date: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  counted_amount: number | null;
  difference: number | null;
  status: "open" | "closed";
};

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("due_date");
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });
}

export function useSetting(key: string, defaultValue = "") {
  return useQuery({
    queryKey: ["setting", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return (data?.value as string | undefined) ?? defaultValue;
    },
  });
}

export function useDefaultCreditFee() {
  const q = useSetting("default_credit_fee", "3");
  return { ...q, fee: Number(q.data ?? 3) || 0 };
}

export function useDefaultDebitFee() {
  const q = useSetting("default_debit_fee", "1.99");
  return { ...q, fee: Number(q.data ?? 1.99) || 0 };
}

export function useCardFees() {
  const credit = useDefaultCreditFee();
  const debit = useDefaultDebitFee();
  return { credit: credit.fee, debit: debit.fee };
}

export function useTodayCashSession() {
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["cash_session", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sessions")
        .select("*")
        .eq("date", today)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as CashSession | null) ?? null;
    },
  });
}

export type Barbeiro = {
  id: string;
  nome: string;
  telefone: string | null;
  porcentagem_comissao: number;
  ativo: boolean;
};

export function useBarbeiros(onlyActive = false) {
  return useQuery({
    queryKey: ["barbeiros", onlyActive ? "ativos" : "todos"],
    queryFn: async () => {
      let q = supabase.from("barbeiros").select("*").order("nome");
      if (onlyActive) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Barbeiro[];
    },
  });
}
