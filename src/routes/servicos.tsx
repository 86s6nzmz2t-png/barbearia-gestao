import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app-shell";
import { brl } from "@/lib/finance";
import { useServices, type Service } from "@/lib/queries";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Barbearia" },
      { name: "description", content: "Cadastro de serviços e preços." },
    ],
  }),
  component: ServicesPage,
});

type FormState = { name: string; price: string };
const empty: FormState = { name: "", price: "" };

function parseNum(v: string) { return parseFloat(v.replace(",", ".")); }

function ServicesPage() {
  const qc = useQueryClient();
  const { data: services = [], isLoading } = useServices();
  const [form, setForm] = useState<FormState>(empty);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["services"] });

  const create = useMutation({
    mutationFn: async (f: FormState) => {
      const price = parseNum(f.price);
      if (!f.name.trim()) throw new Error("Nome obrigatório");
      if (!Number.isFinite(price) || price < 0) throw new Error("Preço inválido");
      const { error } = await supabase.from("services").insert({ name: f.name.trim(), price });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Serviço cadastrado"); setForm(empty); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: FormState }) => {
      const price = parseNum(f.price);
      const { error } = await supabase.from("services").update({ name: f.name.trim(), price }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Serviço atualizado"); setEditing(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Serviço excluído"); setDeleting(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-10 py-8 md:py-12">
      <PageHeader title="Serviços" subtitle="Cadastre os serviços e preços usados nos lançamentos." />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium flex items-center gap-2">
            <Plus className="h-4 w-4 text-gold" /> Novo serviço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
            onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}
          >
            <div className="md:col-span-7">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Nome</Label>
              <Input placeholder="Ex: Cabelo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Preço (R$)</Label>
              <Input inputMode="decimal" placeholder="0,00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={create.isPending} className="w-full bg-gold text-primary-foreground hover:bg-gold/90">
                Cadastrar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium flex items-center gap-2">
            <Scissors className="h-4 w-4 text-gold" /> Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : services.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum serviço cadastrado.</TableCell></TableRow>
              ) : services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="text-right tabular-nums text-gold">{brl(Number(s.price))}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setForm({ name: s.name, price: String(s.price).replace(".", ",") }); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(s)}>
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Editar serviço</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Preço (R$)</Label>
              <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              className="bg-gold text-primary-foreground hover:bg-gold/90"
              disabled={update.isPending}
              onClick={() => editing && update.mutate({ id: editing.id, f: form })}
            >Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
            <AlertDialogDescription>Lançamentos antigos manterão o nome registrado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && remove.mutate(deleting.id)}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
