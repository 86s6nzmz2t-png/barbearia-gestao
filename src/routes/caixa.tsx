import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Lock, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
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
import {
  PAYMENT_METHODS, brl, computeNet, defaultFeeFor, effectiveFeePercent, isCard, paymentLabel,
} from "@/lib/finance";
import { useCardFees, useServices } from "@/lib/queries";

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
  const cardFees = useCardFees();
  const { data: services = [] } = useServices();
  const { isOpen: cashOpen, session } = useCashSessionGate();

  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [editing, setEditing] = useState<TxRow | null>(null);
  const [deleting, setDeleting] = useState<TxRow | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, client:clients(name)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as TxRow[];
    },
  });

  const today = format(new Date(), "yyyy-MM-dd");
  const cashInTotal = useMemo(() => transactions
    .filter((t) => t.date === today && t.payment_method === "dinheiro")
    .reduce((s, t) => s + Number(t.amount), 0), [transactions, today]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["transactions"] });

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
      client_id: f.client_id === "none" ? null : f.client_id,
      date: f.date,
      cash_session_id: session?.id ?? null,
    };
  };

  const createMut = useMutation({
    mutationFn: async (f: FormState) => {
      if (!cashOpen) throw new Error("Abra o caixa antes de lançar.");
      const { error } = await supabase.from("transactions").insert(buildPayload(f));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento registrado");
      setForm(emptyForm());
      invalidate();
    },
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

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-10 py-8 md:py-12">
      <PageHeader title="Fluxo de Caixa" subtitle="Registre e acompanhe todos os atendimentos." />

      <CashSessionBanner cashInTotal={cashInTotal} />

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
            <Field className="md:col-span-4" label="Serviço">
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
            {showFee ? (
              <Field className="md:col-span-1" label="Taxa %">
                <Input
                  inputMode="decimal"
                  value={form.fee_percent}
                  onChange={(e) => setForm({ ...form, fee_percent: e.target.value })}
                />
              </Field>
            ) : (<div className="hidden md:block md:col-span-1" />)}
            <Field className="md:col-span-1" label="Data">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </Field>
            <Field className="md:col-span-2" label="Cliente">
              <div className="flex gap-1.5">
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem cliente —</SelectItem>
                    {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
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
              <Button type="submit" disabled={createMut.isPending || !cashOpen} className="bg-gold text-primary-foreground hover:bg-gold/90">
                {createMut.isPending ? "Salvando..." : "Registrar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum lançamento ainda.</TableCell></TableRow>
                ) : transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(t.date + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{t.service}</TableCell>
                    <TableCell className="text-muted-foreground">{t.client?.name ?? "—"}</TableCell>
                    <TableCell><span className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground">{paymentLabel(t.payment_method)}</span></TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {Number(t.fee_percent) > 0 ? `${Number(t.fee_percent)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brl(Number(t.amount))}</TableCell>
                    <TableCell className="text-right tabular-nums text-gold">{brl(Number(t.net_amount))}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => {
                          setEditing(t);
                          setForm({
                            amount: String(t.amount).replace(".", ","),
                            service: t.service,
                            payment_method: t.payment_method,
                            fee_percent: String(t.fee_percent ?? defaultFeeFor(t.payment_method, cardFees)),
                            client_id: t.client_id ?? "none",
                            date: t.date,
                          });
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(t)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem cliente —</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
