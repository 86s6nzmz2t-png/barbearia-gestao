import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek, startOfMonth, eachDayOfInterval, eachMonthOfInterval, endOfDay, endOfWeek, endOfMonth, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, Wallet, Scissors, Receipt, TrendingDown, Banknote, CreditCard, Smartphone, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

/** Meses disponíveis para consulta histórica (36 meses até o mês corrente). */
function buildMonthOptions() {
  const now = startOfMonth(new Date());
  return Array.from({ length: 36 }, (_, i) => {
    const d = subMonths(now, i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM 'de' yyyy", { locale: ptBR }) };
  });
}

function monthFromKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1);
}

/** Janela usada pelos cards/relatórios (período efetivo consultado). */
function getWindow(period: Period, monthRef: Date) {
  const now = new Date();
  if (period === "diario") return { from: startOfDay(now), to: endOfDay(now) };
  if (period === "semanal") return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  return { from: startOfMonth(monthRef), to: endOfMonth(monthRef) };
}

/** Intervalo carregado do banco (inclui histórico para o gráfico de evolução). */
function getRange(period: Period, monthRef: Date) {
  const now = new Date();
  if (period === "diario") {
    return { from: startOfDay(subDays(now, 13)), to: endOfDay(now), step: "day" as const };
  }
  if (period === "semanal") {
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }), step: "day" as const };
  }
  return { from: startOfMonth(subMonths(monthRef, 5)), to: endOfMonth(monthRef), step: "month" as const };
}


function Dashboard() {
  const [period, setPeriod] = useState<Period>("diario");
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [monthKey, setMonthKey] = useState(() => format(new Date(), "yyyy-MM"));
  const monthRef = useMemo(() => monthFromKey(monthKey), [monthKey]);

  const range = useMemo(() => getRange(period, monthRef), [period, monthRef]);
  const window = useMemo(() => getWindow(period, monthRef), [period, monthRef]);

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
    queryKey: ["expenses", "month", format(window.from, "yyyy-MM-dd"), format(window.to, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, due_date")
        .gte("due_date", format(window.from, "yyyy-MM-dd"))
        .lte("due_date", format(window.to, "yyyy-MM-dd"));
      if (error) throw error;
      return (data ?? []).reduce((s, e) => s + Number(e.amount), 0);
    },
  });

  const windowTransactions = useMemo(() => {
    const fromStr = format(window.from, "yyyy-MM-dd");
    const toStr = format(window.to, "yyyy-MM-dd");
    return transactions.filter((t) => t.date >= fromStr && t.date <= toStr);
  }, [transactions, window]);

  const { data: barbeiros = [] } = useBarbeiros();

  const commissions = useMemo(() => {
    const rows = barbeiros.map((b) => {
      const mine = windowTransactions.filter((t) => t.barbeiro_id === b.id);
      const gross = mine.reduce((s, t) => s + Number(t.amount), 0);
      const pct = Number(b.porcentagem_comissao) || 0;
      const commission = Math.round(gross * (pct / 100) * 100) / 100;
      return {
        id: b.id,
        nome: b.nome,
        pct,
        gross,
        commission,
        shop: Math.round((gross - commission) * 100) / 100,
        count: mine.length,
      };
    }).filter((r) => r.gross > 0 || r.count > 0);

    const unassigned = windowTransactions.filter((t) => !t.barbeiro_id);
    const unassignedGross = unassigned.reduce((s, t) => s + Number(t.amount), 0);

    return {
      rows: rows.sort((a, b) => b.gross - a.gross),
      unassignedGross,
      unassignedCount: unassigned.length,
      totalCommission: rows.reduce((s, r) => s + r.commission, 0),
    };
  }, [windowTransactions, barbeiros]);

  const totals = useMemo(() => {
    const gross = windowTransactions.reduce((s, t) => s + Number(t.amount), 0);
    const net = windowTransactions.reduce((s, t) => s + Number(t.net_amount), 0);
    return {
      gross,
      net,
      count: windowTransactions.length,
      shopNet: Math.round((gross - commissions.totalCommission) * 100) / 100,
      profit: net - monthlyExpenses,
    };
  }, [windowTransactions, monthlyExpenses, commissions.totalCommission]);

  const paymentBreakdown = useMemo(() => {
    const methods = [
      { key: "dinheiro", label: "Dinheiro", icon: <Banknote className="h-5 w-5" /> },
      { key: "pix", label: "Pix", icon: <Smartphone className="h-5 w-5" /> },
      { key: "cartao_credito", label: "Cartão de Crédito", icon: <CreditCard className="h-5 w-5" /> },
      { key: "cartao_debito", label: "Cartão de Débito", icon: <CreditCard className="h-5 w-5" /> },
    ] as const;

    const total = windowTransactions.reduce((s, t) => s + Number(t.amount), 0);

    return methods.map((m) => {
      const amount = windowTransactions
        .filter((t) => t.payment_method === m.key)
        .reduce((s, t) => s + Number(t.amount), 0);
      return { ...m, amount, percent: total > 0 ? Math.round((amount / total) * 100) : 0 };
    });
  }, [windowTransactions]);

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
          : format(b, "MMM/yy", { locale: ptBR });
      return { label, valor: sum };
    });
  }, [transactions, range]);

  const recent = (period === "mensal" ? windowTransactions : transactions).slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-10 py-8 md:py-12">
      <PageHeader
        title="Dashboard"
        subtitle="Acompanhe o faturamento e os atendimentos da sua barbearia."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList className="bg-card border border-border">
                <TabsTrigger value="diario">Diário</TabsTrigger>
                <TabsTrigger value="semanal">Semanal</TabsTrigger>
                <TabsTrigger value="mensal">Mensal</TabsTrigger>
              </TabsList>
            </Tabs>
            {period === "mensal" && (
              <Select value={monthKey} onValueChange={setMonthKey}>
                <SelectTrigger className="w-[190px] bg-card border-border capitalize">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="capitalize">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
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
        <>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Mês consultado:{" "}
            <span className="text-foreground capitalize">
              {format(activeRange.from, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>{" "}
            ({format(activeRange.from, "dd/MM")} – {format(activeRange.to, "dd/MM/yyyy")})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Faturamento Líquido (Barbearia)"
              value={brl(totals.shopNet)}
              hint={`${brl(commissions.totalCommission)} em comissões`}
              loading={isLoading}
            />
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
        </>
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
          <CardTitle className="font-display text-xl font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" /> Resumo de Comissões por Barbeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barbeiro</TableHead>
                  <TableHead className="text-right">Atend.</TableHead>
                  <TableHead className="text-right">Total faturado</TableHead>
                  <TableHead className="text-right">% Comissão</TableHead>
                  <TableHead className="text-right">Comissão (R$)</TableHead>
                  <TableHead className="text-right">Líquido barbearia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum atendimento com barbeiro no período.
                  </TableCell></TableRow>
                ) : commissions.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(r.gross)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.pct}%</TableCell>
                    <TableCell className="text-right tabular-nums text-gold">{brl(r.commission)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(r.shop)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3">
            {commissions.rows.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum atendimento com barbeiro no período.</p>
            ) : commissions.rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-secondary/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-base font-semibold">{r.nome}</h3>
                  <span className="text-xs text-muted-foreground">{r.count} atend. · {r.pct}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Faturado</p>
                    <p className="tabular-nums font-medium">{brl(r.gross)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Comissão</p>
                    <p className="tabular-nums font-medium text-gold">{brl(r.commission)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Barbearia</p>
                    <p className="tabular-nums font-medium">{brl(r.shop)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(commissions.rows.length > 0 || commissions.unassignedCount > 0) && (
            <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                Total de comissões no período: <span className="text-gold font-medium tabular-nums">{brl(commissions.totalCommission)}</span>
              </span>
              {commissions.unassignedCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {commissions.unassignedCount} lançamento(s) sem barbeiro ({brl(commissions.unassignedGross)})
                </span>
              )}
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
