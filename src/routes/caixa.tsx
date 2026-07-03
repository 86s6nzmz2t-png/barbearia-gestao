import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownCircle, ArrowUpCircle, CalendarDays, Lock, Pencil, Plus, Trash2, UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/app-shell";
import { CashSessionBanner, useCashSessionGate } from "@/components/cash-session-banner";
import { QuickClientDialog } from "@/components/quick-client-dialog";
import { CashMovementDialog } from "@/components/cash-movement-dialog";
import { ClientCombobox } from "@/components/client-combobox";
import {
  PAYMENT_METHODS, brl, computeNet, defaultFeeFor, effectiveFeePercent, isCard, paymentLabel,
} from "@/lib/finance";
import { useCardFees, useServices } from "@/lib/queries";
import { useUserId } from "@/lib/auth";

export const Route = createFileRoute("/caixa")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — Barbearia" },
      { name: "description", content: "Lançamentos e histórico financeiro da barbearia." },
    ],
  }),
  component: CaixaPage,
});

type TxRow = {
  id: string;
  amount: number;
  net_amount: number;
  fee_percent: number;
  service: string;
  payment_method: string;
  client_id: string | null;
  date: string;
  cash_session_id: string | null;
  client: { name: string } | null;
};

type MovementRow = {
  id: string;
  type: "in" | "out";
  amount: number;
  description: string;
  date: string;
  cash_session_id: string | null;
  created_at: string;
};

type FormState = {
  amount: string;
  service: string;
  payment_method: string;
  fee_percent: string;
  client_id: string;
  date: string;
};

function emptyForm(): FormState {
  return {
    amount: "",
    service: "",
    payment_method: "dinheiro",
    fee_percent: "0",
    client_id: "none",
    date: format(new Date(), "yyyy-MM-dd"),
  };
}

function parseNum(v: string) { return parseFloat(v.replace(",", ".")); }

function CaixaPage() {
  const qc = useQueryClient();
  const userId = useUserId();
  const cardFees = useCardFees();
  const { data: services = [] } = useServices();
  const { isOpen: cashOpen, session } = useCashSessionGate();
  const today = format(new Date(), "yyyy-MM-dd");

  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [editing, setEditing] = useState<TxRow | null>(null);
  const [deleting, setDeleting] = useState<TxRow | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState<null | "in" | "out">(null);
  const [historyDate, setHistoryDate] = useState<string>("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Current view scope: history date if chosen, else today's open session
  const viewingHistory = !!historyDate;
  const scopeDate = historyDate || today;

  const txQuery = useQuery({
    queryKey: ["transactions", "scope", viewingHistory ? `date:${historyDate}` : `session:${session?.id ?? "none"}`],
    queryFn: async () => {
      let query = supabase
        .from("transactions")
        .select("*, client:clients(name)")
        .order("created_at", { ascending: false });
      if (viewingHistory) {
        query = query.eq("date", historyDate);
      } else if (session?.id) {
        query = query.eq("cash_session_id", session.id);
      } else {
        return [] as TxRow[];
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TxRow[];
    },
  });

  const movQuery = useQuery({
    queryKey: ["cash_movements", "scope", viewingHistory ? `date:${historyDate}` : `session:${session?.id ?? "none"}`],
    queryFn: async () => {
      let query = supabase
        .from("cash_movements")
        .select("*")
        .order("created_at", { ascending: false });
      if (viewingHistory) {
        query = query.eq("date", historyDate);
      } else if (session?.id) {
        query = query.eq("cash_session_id", session.id);
      } else {
        return [] as MovementRow[];
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as MovementRow[];
    },
  });

  const transactions = txQuery.data ?? [];
  const movements = movQuery.data ?? [];

  // Totals for the current scope
  const totals = useMemo(() => {
    const gross = transactions.reduce((s, t) => s + Number(t.amount), 0);
    const net = transactions.reduce((s, t) => s + Number(t.net_amount), 0);
    return { gross, net, count: transactions.length };
  }, [transactions]);

  // Cash totals (for fechamento) — always today's open session
  const cashTodayQuery = useQuery({
    queryKey: ["cash_today", session?.id ?? "none"],
    enabled: !!session?.id,
    queryFn: async () => {
      const [txs, mvs] = await Promise.all([
        supabase.from("transactions").select("amount, payment_method").eq("cash_session_id", session!.id),
        supabase.from("cash_movements").select("type, amount").eq("cash_session_id", session!.id),
      ]);
      if (txs.error) throw txs.error;
      if (mvs.error) throw mvs.error;
      const cashIn = (txs.data ?? [])
        .filter((t) => t.payment_method === "dinheiro")
        .reduce((s, t) => s + Number(t.amount), 0);
      const movNet = (mvs.data ?? []).reduce((s, m) => s + (m.type === "in" ? Number(m.amount) : -Number(m.amount)), 0);
      return { cashIn, movNet };
    },
  });
  const cashInTotal = cashTodayQuery.data?.cashIn ?? 0;
  const movementsNet = cashTodayQuery.data?.movNet ?? 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["cash_today"] });
  };

  const buildPayload = (f: FormState) => {
    const amount = parseNum(f.amount);
    if (!amount || amount <= 0) throw new Error("Informe um valor válido.");
    if (!f.service) throw new Error("Selecione um serviço.");
    const feePercent = effectiveFeePercent(f.payment_method, parseNum(f.fee_percent) || 0);
    return {
      amount,
      net_amount: computeNet(amount, f.payment_method, feePercent),
      fee_percent: feePercent,
      service: f.service,
      payment_method: f.payment_method,
      client_id: f.client_id === "none" || f.client_id === "avulso" ? null : f.client_id,
      date: f.date,
      cash_session_id: session?.id ?? null,
      user_id: userId,
    };
  };

  const createMut = useMutation({
    mutationFn: async (f: FormState) => {
      if (!cashOpen) throw new Error("Abra o caixa antes de lançar.");
      const { error } = await supabase.from("transactions").insert(buildPayload(f));
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lançamento registrado"); setForm(emptyForm()); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });



  const updateMut = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: FormState }) => {
      const { error } = await supabase.from("transactions").update(buildPayload(f)).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lançamento atualizado"); setEditing(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lançamento excluído"); setDeleting(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMovementMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cash_movements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação removida");
      qc.invalidateQueries({ queryKey: ["cash_movements"] });
      qc.invalidateQueries({ queryKey: ["cash_today"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const showFee = isCard(form.payment_method);
  const previewAmount = parseNum(form.amount) || 0;
  const previewFee = effectiveFeePercent(form.payment_method, parseNum(form.fee_percent) || 0);
  const previewNet = previewAmount > 0 ? computeNet(previewAmount, form.payment_method, previewFee) : 0;

  const onSelectService = (id: string) => {
    const svc = services.find((s) => s.id === id);
    setForm((prev) => ({
      ...prev,
      service: svc?.name ?? "",
      amount: svc ? String(svc.price).replace(".", ",") : prev.amount,
    }));
  };
  const selectedServiceId = services.find((s) => s.name === form.service)?.id ?? "";

  // Combined chronological feed: transactions + movements
  type FeedItem =
    | { kind: "tx"; data: TxRow; ts: string }
    | { kind: "mov"; data: MovementRow; ts: string };
  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [
      ...transactions.map((t) => ({ kind: "tx" as const, data: t, ts: t.date })),
      ...movements.map((m) => ({ kind: "mov" as const, data: m, ts: m.created_at })),
    ];
    return items.sort((a, b) => (b.ts > a.ts ? 1 : -1));
  }, [transactions, movements]);

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-10 py-8 md:py-12">
      <PageHeader title="Fluxo de Caixa" subtitle="Registre e acompanhe todos os atendimentos." />

      <CashSessionBanner cashInTotal={cashInTotal} movementsNet={movementsNet} />

      <Card className="mb-8 relative">
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium flex items-center gap-2">
            <Plus className="h-4 w-4 text-gold" /> Novo lançamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!cashOpen && (
            <div className="absolute inset-0 z-10 rounded-lg bg-background/70 backdrop-blur-sm flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" /> Abra o caixa para liberar lançamentos
              </div>
            </div>
          )}
          <form
            className="grid grid-cols-1 md:grid-cols-12 gap-3"
            onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }}
          >
            <Field className="md:col-span-3" label="Serviço">
              <Select value={selectedServiceId} onValueChange={onSelectService}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {services.length === 0 ? (
                    <SelectItem value="__none" disabled>Nenhum serviço cadastrado</SelectItem>
                  ) : services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — {brl(Number(s.price))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-2" label="Valor (R$)">
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </Field>
            <Field className="md:col-span-2" label="Pagamento">
              <Select
                value={form.payment_method}
                onValueChange={(v) => setForm({ ...form, payment_method: v, fee_percent: String(defaultFeeFor(v, cardFees)) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {showFee && (
              <Field className="md:col-span-1" label="Taxa %">
                <Input
                  inputMode="decimal"
                  value={form.fee_percent}
                  onChange={(e) => setForm({ ...form, fee_percent: e.target.value })}
                />
              </Field>
            )}
            <Field className="md:col-span-2" label="Data">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </Field>
            <Field className={showFee ? "md:col-span-2" : "md:col-span-3"} label="Cliente">
              <div className="flex gap-1.5">
                <div className="flex-1 min-w-0">
                  <ClientCombobox
                    clients={clients}
                    value={form.client_id}
                    onChange={(v) => setForm({ ...form, client_id: v })}
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="shrink-0 border-gold/40 text-gold hover:bg-gold/10 hover:text-gold"
                  onClick={() => setQuickOpen(true)}
                  title="Cadastrar novo cliente"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </Field>
            <div className="md:col-span-12 flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {showFee
                  ? `Líquido estimado: ${brl(previewNet)} (taxa ${previewFee}%)`
                  : "Sem taxa — líquido = bruto"}
              </p>
              <Button
                type="submit"
                disabled={createMut.isPending || !cashOpen}
                className="bg-gold text-primary-foreground hover:bg-gold/90"
              >
                {createMut.isPending ? "Salvando..." : "Registrar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Movements + History controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base font-medium">Movimentações avulsas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-emerald-600/40 text-emerald-500 hover:bg-emerald-600/10 hover:text-emerald-400"
              disabled={!cashOpen}
              onClick={() => setMovementOpen("in")}
            >
              <ArrowUpCircle className="h-4 w-4 mr-1.5" /> Adicionar dinheiro
            </Button>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={!cashOpen}
              onClick={() => setMovementOpen("out")}
            >
              <ArrowDownCircle className="h-4 w-4 mr-1.5" /> Retirar dinheiro
            </Button>
            {!cashOpen && (
              <p className="text-xs text-muted-foreground w-full pt-1">Abra o caixa para registrar movimentações.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gold" /> Consultar histórico por data
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={historyDate}
              max={today}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="max-w-[200px]"
            />
            {historyDate && (
              <Button variant="ghost" size="sm" onClick={() => setHistoryDate("")}>
                Voltar ao caixa aberto
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary cards for scope */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Total bruto" value={brl(totals.gross)} />
        <SummaryCard label="Total líquido" value={brl(totals.net)} accent />
        <SummaryCard label="Atendimentos" value={String(totals.count)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium">
            {viewingHistory
              ? `Histórico de ${format(new Date(scopeDate + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}`
              : "Lançamentos do caixa aberto"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txQuery.isLoading || movQuery.isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : feed.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {viewingHistory ? "Nenhum registro nessa data." : cashOpen ? "Nenhum lançamento no caixa atual." : "Abra o caixa para começar."}
                  </TableCell></TableRow>
                ) : feed.map((item) => item.kind === "tx" ? (
                  <TableRow key={`tx-${item.data.id}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(item.data.date + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{item.data.service}</TableCell>
                    <TableCell className="text-muted-foreground">{item.data.client?.name ?? "—"}</TableCell>
                    <TableCell><span className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground">{paymentLabel(item.data.payment_method)}</span></TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {Number(item.data.fee_percent) > 0 ? `${Number(item.data.fee_percent)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brl(Number(item.data.amount))}</TableCell>
                    <TableCell className="text-right tabular-nums text-gold">{brl(Number(item.data.net_amount))}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => {
                          setEditing(item.data);
                          setForm({
                            amount: String(item.data.amount).replace(".", ","),
                            service: item.data.service,
                            payment_method: item.data.payment_method,
                            fee_percent: String(item.data.fee_percent ?? defaultFeeFor(item.data.payment_method, cardFees)),
                            client_id: item.data.client_id ?? "none",
                            date: item.data.date,
                          });
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(item.data)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow
                    key={`mov-${item.data.id}`}
                    className={item.data.type === "in"
                      ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                      : "bg-destructive/5 hover:bg-destructive/10"}
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(item.data.date + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell colSpan={3} className={item.data.type === "in" ? "text-emerald-500" : "text-destructive"}>
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        {item.data.type === "in"
                          ? <ArrowUpCircle className="h-4 w-4" />
                          : <ArrowDownCircle className="h-4 w-4" />}
                        {item.data.type === "in" ? "Suprimento" : "Sangria"}
                      </span>
                      {item.data.description && (
                        <span className="text-muted-foreground"> · {item.data.description}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                    <TableCell className={`text-right tabular-nums ${item.data.type === "in" ? "text-emerald-500" : "text-destructive"}`}>
                      {item.data.type === "in" ? "+" : "−"}{brl(Number(item.data.amount))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => deleteMovementMut.mutate(item.data.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile / Tablet cards */}
          <div className="md:hidden space-y-3">
            {txQuery.isLoading || movQuery.isLoading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : feed.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {viewingHistory ? "Nenhum registro nessa data." : cashOpen ? "Nenhum lançamento no caixa atual." : "Abra o caixa para começar."}
              </p>
            ) : (
              feed.map((item) => (
                <div
                  key={item.kind === "tx" ? `tx-card-${item.data.id}` : `mov-card-${item.data.id}`}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  {item.kind === "tx" ? (
                    <>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="font-display text-base font-semibold text-foreground leading-tight">
                          {item.data.service}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10"
                            onClick={() => {
                              setEditing(item.data);
                              setForm({
                                amount: String(item.data.amount).replace(".", ","),
                                service: item.data.service,
                                payment_method: item.data.payment_method,
                                fee_percent: String(item.data.fee_percent ?? defaultFeeFor(item.data.payment_method, cardFees)),
                                client_id: item.data.client_id ?? "none",
                                date: item.data.date,
                              });
                            }}
                          >
                            <Pencil className="h-5 w-5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10"
                            onClick={() => setDeleting(item.data)}
                          >
                            <Trash2 className="h-5 w-5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Valor</p>
                          <p className="font-medium tabular-nums">{brl(Number(item.data.amount))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Pagamento</p>
                          <span className="inline-block text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground mt-0.5">
                            {paymentLabel(item.data.payment_method)}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Cliente</p>
                          <p className="text-foreground truncate">{item.data.client?.name ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Líquido</p>
                          <p className="font-medium tabular-nums text-gold">{brl(Number(item.data.net_amount))}</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {format(new Date(item.data.date + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
                        </span>
                        {Number(item.data.fee_percent) > 0 && (
                          <span>Taxa {Number(item.data.fee_percent)}%</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className={`font-display text-base font-semibold leading-tight ${item.data.type === "in" ? "text-emerald-500" : "text-destructive"}`}>
                          <span className="inline-flex items-center gap-1.5">
                            {item.data.type === "in" ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                            {item.data.type === "in" ? "Suprimento" : "Sangria"}
                          </span>
                        </h3>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10"
                          onClick={() => deleteMovementMut.mutate(item.data.id)}
                        >
                          <Trash2 className="h-5 w-5 text-destructive" />
                        </Button>
                      </div>
                      <div className="text-sm">
                        <p className="font-medium tabular-nums text-lg">
                          {item.data.type === "in" ? "+" : "−"}{brl(Number(item.data.amount))}
                        </p>
                        {item.data.description && (
                          <p className="text-muted-foreground mt-1">{item.data.description}</p>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                        {format(new Date(item.data.date + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Editar lançamento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Data">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field className="col-span-2" label="Serviço">
              <Select value={selectedServiceId} onValueChange={onSelectService}>
                <SelectTrigger><SelectValue placeholder={form.service || "Selecione..."} /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} — {brl(Number(s.price))}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pagamento">
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v, fee_percent: String(defaultFeeFor(v, cardFees)) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {isCard(form.payment_method) && (
              <Field label="Taxa (%)">
                <Input inputMode="decimal" value={form.fee_percent} onChange={(e) => setForm({ ...form, fee_percent: e.target.value })} />
              </Field>
            )}
            <Field className="col-span-2" label="Cliente">
              <ClientCombobox
                clients={clients}
                value={form.client_id}
                onChange={(v) => setForm({ ...form, client_id: v })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              className="bg-gold text-primary-foreground hover:bg-gold/90"
              disabled={updateMut.isPending}
              onClick={() => editing && updateMut.mutate({ id: editing.id, f: form })}
            >Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && deleteMut.mutate(deleting.id)}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuickClientDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onCreated={(c) => {
          qc.setQueryData<{ id: string; name: string }[]>(["clients"], (prev) => {
            const list = prev ?? [];
            if (list.some((x) => x.id === c.id)) return list;
            return [...list, c].sort((a, b) => a.name.localeCompare(b.name));
          });
          qc.invalidateQueries({ queryKey: ["clients"] });
          setForm((prev) => ({ ...prev, client_id: c.id }));
        }}
      />

      <CashMovementDialog
        open={!!movementOpen}
        type={movementOpen ?? "in"}
        cashSessionId={session?.id ?? null}
        onOpenChange={(o) => { if (!o) setMovementOpen(null); }}
      />

      <Dialog open={!!infinitePayState} onOpenChange={() => { /* bloqueado durante processamento */ }}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold animate-pulse" />
              Maquininha InfinitePay
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm">
              {infinitePayState?.status === "sending"
                ? "Enviando cobrança para a nuvem da InfinitePay..."
                : "Aguardando aprovação na maquininha..."}
            </p>
            {infinitePayState && (
              <p className="font-display text-2xl tabular-nums text-gold">
                {brl(infinitePayState.amount)}
              </p>
            )}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-1/3 bg-gold animate-pulse" />
            </div>
            <p className="text-xs text-muted-foreground">
              Não feche essa janela até a maquininha confirmar o pagamento.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`font-display text-2xl mt-1 tabular-nums ${accent ? "text-gold" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
