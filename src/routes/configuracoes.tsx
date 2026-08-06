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
import { useAuth, useIsAdmin, useUserId } from "@/lib/auth";
import { UserAccessSection } from "@/components/user-access-section";


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
  const { loading, profileError, refreshProfile } = useAuth();
  const isAdmin = useIsAdmin();

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-10 py-8 md:py-12 space-y-6">
      <PageHeader title="Configurações" subtitle="Defina taxas padrão e gerencie despesas fixas." />
      {loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Verificando permissões de acesso...
          </CardContent>
        </Card>
      ) : profileError ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar suas permissões de acesso.
            </p>
            <Button variant="outline" onClick={() => void refreshProfile()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isAdmin ? (
        <UserAccessSection />
      ) : null}
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

type ExpenseForm = {
  description: string;
  amount: string;
  due_date: string;
  recurring: boolean;
  recurrence_day: string;
};

function emptyExpense(): ExpenseForm {
  const today = new Date();
  return {
    description: "",
    amount: "",
    due_date: format(today, "yyyy-MM-dd"),
    recurring: false,
    recurrence_day: String(today.getDate()),
  };
}

function ExpensesSection() {
  const qc = useQueryClient();
  const userId = useUserId();
  const { data: expenses = [], isLoading } = useExpenses();
  const [form, setForm] = useState<ExpenseForm>(() => emptyExpense());
  const [editingId, setEditingId] = useState<string | null>(null);

  const buildPayload = () => {
    const amount = parseFloat(form.amount.replace(",", "."));
    if (!form.description.trim()) throw new Error("Descrição obrigatória");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor inválido");
    let recurrenceDay: number | null = null;
    if (form.recurring) {
      recurrenceDay = parseInt(form.recurrence_day, 10);
      if (!Number.isFinite(recurrenceDay) || recurrenceDay < 1 || recurrenceDay > 31)
        throw new Error("Dia de vencimento deve ser entre 1 e 31");
    }
    return {
      description: form.description.trim(),
      amount,
      due_date: form.due_date,
      recurring: form.recurring,
      recurrence_day: recurrenceDay,
    };
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (editingId) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert({ ...payload, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Despesa atualizada" : "Despesa cadastrada");
      setForm(emptyExpense());
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa excluída");
      if (editingId) { setEditingId(null); setForm(emptyExpense()); }
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setForm({
      description: e.description,
      amount: String(e.amount).replace(".", ","),
      due_date: e.due_date,
      recurring: !!e.recurring,
      recurrence_day: String(
        e.recurrence_day ?? Number(e.due_date.slice(8, 10)) ?? 1,
      ),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl font-medium flex items-center gap-2">
          <Receipt className="h-4 w-4 text-gold" /> Despesas Fixas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
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
          <div className="md:col-span-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Vencimento</Label>
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>

          <div className="md:col-span-5 flex items-center gap-2">
            <Checkbox
              id="expense-recurring"
              checked={form.recurring}
              onCheckedChange={(v) =>
                setForm((f) => ({
                  ...f,
                  recurring: v === true,
                  recurrence_day:
                    v === true && !f.recurrence_day
                      ? String(Number(f.due_date.slice(8, 10)) || 1)
                      : f.recurrence_day,
                }))
              }
            />
            <Label htmlFor="expense-recurring" className="text-sm cursor-pointer">
              Recorrente (repete todo mês)
            </Label>
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Dia do vencimento</Label>
            <Input
              type="number"
              min={1}
              max={31}
              disabled={!form.recurring}
              value={form.recurring ? form.recurrence_day : ""}
              placeholder="—"
              onChange={(e) => setForm({ ...form, recurrence_day: e.target.value })}
            />
          </div>
          <div className="md:col-span-4 flex gap-2">
            <Button type="submit" disabled={save.isPending} className="flex-1 bg-gold text-primary-foreground hover:bg-gold/90">
              {editingId ? <><Pencil className="h-4 w-4" /> Salvar</> : <><Plus className="h-4 w-4" /> Adicionar</>}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setForm(emptyExpense()); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Recorrência</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : expenses.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma despesa cadastrada.</TableCell></TableRow>
            ) : expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.description}</TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(e.due_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {e.recurring ? `Todo dia ${e.recurrence_day}` : "Única"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-gold">{brl(Number(e.amount))}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(e)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(e.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type BarbeiroForm = { nome: string; telefone: string; porcentagem_comissao: string; ativo: boolean };

function emptyBarbeiro(): BarbeiroForm {
  return { nome: "", telefone: "", porcentagem_comissao: "50", ativo: true };
}

function BarbeirosSection() {
  const qc = useQueryClient();
  const userId = useUserId();
  const { data: barbeiros = [], isLoading } = useBarbeiros();
  const [form, setForm] = useState<BarbeiroForm>(() => emptyBarbeiro());
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["barbeiros"] });

  const payload = (f: BarbeiroForm) => {
    const pct = parseFloat(f.porcentagem_comissao.replace(",", "."));
    if (!f.nome.trim()) throw new Error("Nome do barbeiro obrigatório");
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new Error("Comissão deve ser entre 0 e 100");
    return {
      nome: f.nome.trim(),
      telefone: f.telefone.trim() || null,
      porcentagem_comissao: pct,
      ativo: f.ativo,
      user_id: userId,
    };
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = payload(form);
      if (editingId) {
        const { error } = await supabase.from("barbeiros").update(body).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("barbeiros").insert(body);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Barbeiro atualizado" : "Barbeiro cadastrado");
      setForm(emptyBarbeiro());
      setEditingId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (b: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("barbeiros").update({ ativo: !b.ativo }).eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("barbeiros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Barbeiro removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl font-medium flex items-center gap-2">
          <Scissors className="h-4 w-4 text-gold" /> Gerenciar Barbeiros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-6"
        >
          <div className="md:col-span-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Nome do barbeiro</Label>
            <Input placeholder="Ex: João" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Telefone</Label>
            <Input placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Comissão (%)</Label>
            <Input inputMode="decimal" value={form.porcentagem_comissao} onChange={(e) => setForm({ ...form, porcentagem_comissao: e.target.value })} />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" disabled={save.isPending} className="flex-1 bg-gold text-primary-foreground hover:bg-gold/90">
              {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" size="icon" onClick={() => { setEditingId(null); setForm(emptyBarbeiro()); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : barbeiros.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum barbeiro cadastrado.</TableCell></TableRow>
            ) : barbeiros.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.nome}</TableCell>
                <TableCell className="text-muted-foreground">{b.telefone ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-gold">{Number(b.porcentagem_comissao)}%</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => toggleActive.mutate({ id: b.id, ativo: b.ativo })}
                    className={`text-xs px-2 py-1 rounded border ${b.ativo
                      ? "border-emerald-600/40 text-emerald-500 bg-emerald-600/10"
                      : "border-border text-muted-foreground bg-muted/30"}`}
                  >
                    {b.ativo ? "Ativo" : "Inativo"}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => {
                      setEditingId(b.id);
                      setForm({
                        nome: b.nome,
                        telefone: b.telefone ?? "",
                        porcentagem_comissao: String(Number(b.porcentagem_comissao)),
                        ativo: b.ativo,
                      });
                    }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(b.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
