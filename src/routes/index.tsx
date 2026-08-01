import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, endOfDay, endOfWeek, endOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, Wallet, Scissors, Receipt, TrendingDown, Banknote, CreditCard, Smartphone, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { brl, paymentLabel } from "@/lib/finance";
import { useBarbeiros } from "@/lib/queries";
import { PageHeader } from "@/components/app-shell";

type Period = "diario" | "semanal" | "mensal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Barbearia" },
      { name: "description", content: "Relatórios de faturamento e atendimentos da barbearia." },
    ],
  }),
  component: Dashboard,
});

function getRange(period: Period) {
  const now = new Date();
  if (period === "diario") {
    return { from: startOfDay(subDays(now, 13)), to: endOfDay(now), step: "day" as const };
  }
  if (period === "semanal") {
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }), step: "day" as const };
  }
  return { from: startOfMonth(subDays(now, 30 * 5)), to: endOfMonth(now), step: "month" as const };
}

function Dashboard() {
  const [period, setPeriod] = useState<Period>("diario");
  const range = useMemo(() => getRange(period), [period]);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", "range", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, client:clients(name)")
        .gte("date", format(range.from, "yyyy-MM-dd"))
        .lte("date", format(range.to, "yyyy-MM-dd"))
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: monthlyExpenses = 0 } = useQuery({
    enabled: period === "mensal",
    queryKey: ["expenses", "month", format(range.from, "yyyy-MM"), format(range.to, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, due_date")
        .gte("due_date", format(range.from, "yyyy-MM-dd"))
        .lte("due_date", format(range.to, "yyyy-MM-dd"));
      if (error) throw error;
      return (data ?? []).reduce((s, e) => s + Number(e.amount), 0);
    },
  });

  const totals = useMemo(() => {
    const now = new Date();
    let from: Date;
    let to: Date;
    if (period === "diario") {
      from = startOfDay(now);
      to = endOfDay(now);
    } else if (period === "semanal") {
      from = startOfWeek(now, { weekStartsOn: 1 });
      to = endOfWeek(now, { weekStartsOn: 1 });
    } else {
      from = startOfMonth(now);
      to = endOfMonth(now);
    }
    const fromStr = format(from, "yyyy-MM-dd");
    const toStr = format(to, "yyyy-MM-dd");
    const filtered = transactions.filter((t) => t.date >= fromStr && t.date <= toStr);
    const gross = filtered.reduce((s, t) => s + Number(t.amount), 0);
    const net = filtered.reduce((s, t) => s + Number(t.net_amount), 0);
    return { gross, net, count: filtered.length, profit: net - monthlyExpenses };
  }, [transactions, monthlyExpenses, period]);

  const chartData = useMemo(() => {
    const buckets =
      range.step === "day"
        ? eachDayOfInterval({ start: range.from, end: range.to })
        : eachMonthOfInterval({ start: range.from, end: range.to });

    return buckets.map((b) => {
      const inBucket = transactions.filter((t) => {
        const d = new Date(t.date + "T00:00:00");
        if (range.step === "day") return format(d, "yyyy-MM-dd") === format(b, "yyyy-MM-dd");
        return format(d, "yyyy-MM") === format(b, "yyyy-MM");
      });
      const sum = inBucket.reduce((s, t) => s + Number(t.amount), 0);
      const label =
        range.step === "day"
          ? format(b, "dd/MM", { locale: ptBR })
          : format(b, "MMM", { locale: ptBR });
      return { label, valor: sum };
    });
  }, [transactions, range]);

  const paymentBreakdown = useMemo(() => {
    const now = new Date();
    let from: Date;
    let to: Date;
    if (period === "diario") {
      from = startOfDay(now);
      to = endOfDay(now);
    } else if (period === "semanal") {
      from = startOfWeek(now, { weekStartsOn: 1 });
      to = endOfWeek(now, { weekStartsOn: 1 });
    } else {
      from = startOfMonth(now);
      to = endOfMonth(now);
    }
    const fromStr = format(from, "yyyy-MM-dd");
    const toStr = format(to, "yyyy-MM-dd");
    const filtered = transactions.filter((t) => t.date >= fromStr && t.date <= toStr);

    const methods = [
      { key: "dinheiro", label: "Dinheiro", icon: <Banknote className="h-5 w-5" /> },
      { key: "pix", label: "Pix", icon: <Smartphone className="h-5 w-5" /> },
      { key: "cartao_credito", label: "Cartão de Crédito", icon: <CreditCard className="h-5 w-5" /> },
      { key: "cartao_debito", label: "Cartão de Débito", icon: <CreditCard className="h-5 w-5" /> },
    ] as const;

    const total = filtered.reduce((s, t) => s + Number(t.amount), 0);

    return methods.map((m) => {
      const amount = filtered
        .filter((t) => t.payment_method === m.key)
        .reduce((s, t) => s + Number(t.amount), 0);
      return { ...m, amount, percent: total > 0 ? Math.round((amount / total) * 100) : 0 };
    });
  }, [transactions, period]);

  const recent = transactions.slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-10 py-8 md:py-12">
      <PageHeader
        title="Dashboard"
        subtitle="Acompanhe o faturamento e os atendimentos da sua barbearia."
        action={
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="diario">Diário</TabsTrigger>
              <TabsTrigger value="semanal">Semanal</TabsTrigger>
              <TabsTrigger value="mensal">Mensal</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total de Entradas (Bruto)"
          value={brl(totals.gross)}
          loading={isLoading}
        />
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="Valor Líquido Recebido"
          value={brl(totals.net)}
          hint={`${brl(totals.gross - totals.net)} em taxas`}
          loading={isLoading}
        />
        <StatCard
          icon={<Scissors className="h-4 w-4" />}
          label="Total de Atendimentos"
          value={String(totals.count)}
          loading={isLoading}
        />
      </div>

      {period === "mensal" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <StatCard
            icon={<TrendingDown className="h-4 w-4" />}
            label="Despesas Fixas do Mês"
            value={brl(monthlyExpenses)}
            loading={isLoading}
          />
          <StatCard
            icon={<Wallet className="h-4 w-4" />}
            label="Lucro Real Final do Mês"
            value={brl(totals.profit)}
            hint="Líquido − despesas fixas do período"
            loading={isLoading}
          />
        </div>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium">Faturamento por Forma de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          {period !== "mensal" ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {paymentBreakdown.map((p) => (
                <div
                  key={p.key}
                  className="rounded-xl border border-border bg-secondary/40 p-4 flex flex-col items-start gap-2"
                >
                  <div className="flex items-center gap-2 text-gold">
                    {p.icon}
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      {p.label}
                    </span>
                  </div>
                  <span className="font-display text-2xl text-foreground tabular-nums">
                    {isLoading ? "—" : brl(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {paymentBreakdown.map((p) => (
                <div key={p.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="text-gold">{p.icon}</span>
                      {p.label}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-lg text-foreground tabular-nums">
                        {isLoading ? "—" : brl(p.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                        {isLoading ? "" : `${p.percent}%`}
                      </span>
                    </div>
                  </div>
                  <Progress value={isLoading ? 0 : p.percent} className="h-2 bg-secondary" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium">Evolução do faturamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  cursor={{ fill: "color-mix(in oklab, var(--gold) 10%, transparent)" }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  formatter={(v: number) => [brl(v), "Faturamento"]}
                />
                <Bar dataKey="valor" fill="var(--gold)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-xl font-medium">Últimos lançamentos</CardTitle>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento no período.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {t.service}
                      {t.client && <span className="text-muted-foreground"> · {(t.client as { name: string }).name}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(t.date + "T00:00:00"), "dd 'de' MMM", { locale: ptBR })} · {paymentLabel(t.payment_method)}
                    </p>
                  </div>
                  <span className="font-display text-gold tabular-nums">{brl(Number(t.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
          <span className="text-gold">{icon}</span>
          {label}
        </div>
        <div className="mt-3 font-display text-3xl text-foreground tabular-nums">
          {loading ? "—" : value}
        </div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
