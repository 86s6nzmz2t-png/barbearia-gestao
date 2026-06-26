import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/app-shell";
import {
  PAYMENT_METHODS,
  SERVICES,
  brl,
  computeNet,
  paymentLabel,
  serviceLabel,
} from "@/lib/finance";

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
  service: string;
  payment_method: string;
  client_id: string | null;
  date: string;
  client: { name: string } | null;
};

type FormState = {
  amount: string;
  service: string;
  payment_method: string;
  client_id: string;
  date: string;
};

const emptyForm = (): FormState => ({
  amount: "",
  service: "cabelo",
  payment_method: "pix",
  client_id: "none",
  date: format(new Date(), "yyyy-MM-dd"),
});

function CaixaPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editing, setEditing] = useState<TxRow | null>(null);
  const [deleting, setDeleting] = useState<TxRow | null>(null);

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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const createMut = useMutation({
    mutationFn: async (f: FormState) => {
      const amount = parseFloat(f.amount.replace(",", "."));
      if (!amount || amount <= 0) throw new Error("Informe um valor válido.");
      const { error } = await supabase.from("transactions").insert({
        amount,
        net_amount: computeNet(amount, f.payment_method),
        service: f.service,
        payment_method: f.payment_method,
        client_id: f.client_id === "none" ? null : f.client_id,
        date: f.date,
      });
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
      const amount = parseFloat(f.amount.replace(",", "."));
      if (!amount || amount <= 0) throw new Error("Informe um valor válido.");
      const { error } = await supabase
        .from("transactions")
        .update({
          amount,
          net_amount: computeNet(amount, f.payment_method),
          service: f.service,
          payment_method: f.payment_method,
          client_id: f.client_id === "none" ? null : f.client_id,
          date: f.date,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento atualizado");
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído");
      setDeleting(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-10 py-8 md:py-12">
      <PageHeader title="Fluxo de Caixa" subtitle="Registre e acompanhe todos os atendimentos." />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium flex items-center gap-2">
            <Plus className="h-4 w-4 text-gold" /> Novo lançamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 md:grid-cols-12 gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate(form);
            }}
          >
            <Field className="md:col-span-2" label="Valor (R$)">
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </Field>
            <Field className="md:col-span-3" label="Serviço">
              <Select value={form.service} onValueChange={(v) => setForm({ ...form, service: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-3" label="Pagamento">
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-2" label="Data">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </Field>
            <Field className="md:col-span-2" label="Cliente">
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem cliente —</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="md:col-span-12 flex justify-end pt-1">
              <Button type="submit" disabled={createMut.isPending} className="bg-gold text-primary-foreground hover:bg-gold/90">
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
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum lançamento ainda.</TableCell></TableRow>
                ) : (
                  transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {format(new Date(t.date + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{serviceLabel(t.service)}</TableCell>
                      <TableCell className="text-muted-foreground">{t.client?.name ?? "—"}</TableCell>
                      <TableCell><span className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground">{paymentLabel(t.payment_method)}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{brl(Number(t.amount))}</TableCell>
                      <TableCell className="text-right tabular-nums text-gold">{brl(Number(t.net_amount))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(t);
                              setForm({
                                amount: String(t.amount).replace(".", ","),
                                service: t.service,
                                payment_method: t.payment_method,
                                client_id: t.client_id ?? "none",
                                date: t.date,
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleting(t)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Editar */}
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
            <Field label="Serviço">
              <Select value={form.service} onValueChange={(v) => setForm({ ...form, service: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pagamento">
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
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
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && deleteMut.mutate(deleting.id)}
            >
              Excluir
            </AlertDialogAction>
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
