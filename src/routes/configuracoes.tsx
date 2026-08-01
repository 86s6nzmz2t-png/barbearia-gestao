import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Percent, Plus, Receipt, Scissors, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app-shell";
import { brl } from "@/lib/finance";
import { useBarbeiros, useExpenses, useSetting } from "@/lib/queries";
import { useUserId } from "@/lib/auth";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Barbearia" },
      { name: "description", content: "Taxas padrão e despesas fixas." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="max-w-5xl mx-auto px-5 md:px-10 py-8 md:py-12 space-y-6">
      <PageHeader title="Configurações" subtitle="Defina taxas padrão e gerencie despesas fixas." />
      <CardFeesSetting />
      <BarbeirosSection />
      <ExpensesSection />
    </div>
  );
}

function CardFeesSetting() {
  const qc = useQueryClient();
  const userId = useUserId();
  const { data: creditData } = useSetting("default_credit_fee", "3");
  const { data: debitData } = useSetting("default_debit_fee", "1.99");
  const [credit, setCredit] = useState("3");
  const [debit, setDebit] = useState("1.99");
  useEffect(() => { if (creditData !== undefined) setCredit(String(creditData)); }, [creditData]);
  useEffect(() => { if (debitData !== undefined) setDebit(String(debitData)); }, [debitData]);

  const save = useMutation({
    mutationFn: async () => {
      const c = parseFloat(credit.replace(",", "."));
      const d = parseFloat(debit.replace(",", "."));
      if (!Number.isFinite(c) || c < 0) throw new Error("Taxa de crédito inválida");
      if (!Number.isFinite(d) || d < 0) throw new Error("Taxa de débito inválida");
      const now = new Date().toISOString();
      const { error } = await supabase.from("settings").upsert([
        { key: "default_credit_fee", value: String(c), updated_at: now, user_id: userId },
        { key: "default_debit_fee", value: String(d), updated_at: now, user_id: userId },
      ], { onConflict: "user_id,key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Taxas padrão salvas");
      qc.invalidateQueries({ queryKey: ["setting", "default_credit_fee"] });
      qc.invalidateQueries({ queryKey: ["setting", "default_debit_fee"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl font-medium flex items-center gap-2">
          <Percent className="h-4 w-4 text-gold" /> Taxas Padrão do Cartão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Taxa Crédito (%)</Label>
            <Input inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Taxa Débito (%)</Label>
            <Input inputMode="decimal" value={debit} onChange={(e) => setDebit(e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <Button
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="bg-gold text-primary-foreground hover:bg-gold/90"
          >Salvar taxas</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Aplicadas automaticamente quando "Cartão de Crédito" ou "Cartão de Débito" forem selecionados no fluxo de caixa.
        </p>
      </CardContent>
    </Card>
  );
}

function ExpensesSection() {
  const qc = useQueryClient();
  const userId = useUserId();
  const { data: expenses = [], isLoading } = useExpenses();
  const [form, setForm] = useState({ description: "", amount: "", due_date: format(new Date(), "yyyy-MM-dd") });

  const create = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(form.amount.replace(",", "."));
      if (!form.description.trim()) throw new Error("Descrição obrigatória");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("expenses").insert({
        description: form.description.trim(), amount, due_date: form.due_date, user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa cadastrada");
      setForm({ description: "", amount: "", due_date: format(new Date(), "yyyy-MM-dd") });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Despesa excluída"); qc.invalidateQueries({ queryKey: ["expenses"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl font-medium flex items-center gap-2">
          <Receipt className="h-4 w-4 text-gold" /> Despesas Fixas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-6"
        >
          <div className="md:col-span-5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Descrição</Label>
            <Input placeholder="Ex: Aluguel" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Valor (R$)</Label>
            <Input inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Vencimento</Label>
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={create.isPending} className="w-full bg-gold text-primary-foreground hover:bg-gold/90">
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : expenses.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma despesa cadastrada.</TableCell></TableRow>
            ) : expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.description}</TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(e.due_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                <TableCell className="text-right tabular-nums text-gold">{brl(Number(e.amount))}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(e.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
