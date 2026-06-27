import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Pencil, Plus, Search, Trash2, User } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ClientHistoryDialog } from "@/components/client-history-dialog";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Barbearia" },
      { name: "description", content: "Cadastro e preferências dos clientes da barbearia." },
    ],
  }),
  component: ClientesPage,
});

type Client = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
};

type FormState = { name: string; phone: string; whatsapp: string; notes: string };
const emptyForm = (): FormState => ({ name: "", phone: "", whatsapp: "", notes: "" });

function ClientesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [detail, setDetail] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", "full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.whatsapp ?? "").toLowerCase().includes(q),
    );
  }, [clients, search]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["clients"] });

  const createMut = useMutation({
    mutationFn: async (f: FormState) => {
      if (!f.name.trim()) throw new Error("Nome é obrigatório.");
      const { error } = await supabase.from("clients").insert({
        name: f.name.trim(),
        phone: f.phone.trim() || null,
        whatsapp: f.whatsapp.trim() || null,
        notes: f.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente cadastrado");
      setForm(emptyForm());
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: FormState }) => {
      if (!f.name.trim()) throw new Error("Nome é obrigatório.");
      const { error } = await supabase
        .from("clients")
        .update({
          name: f.name.trim(),
          phone: f.phone.trim() || null,
          whatsapp: f.whatsapp.trim() || null,
          notes: f.notes.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente atualizado");
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente excluído");
      setDeleting(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      whatsapp: c.whatsapp ?? "",
      notes: c.notes ?? "",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-10 py-8 md:py-12">
      <PageHeader title="Clientes" subtitle="Cadastro, contato e preferências." />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium flex items-center gap-2">
            <Plus className="h-4 w-4 text-gold" /> Novo cliente
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
            <Field className="md:col-span-4" label="Nome">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field className="md:col-span-3" label="Telefone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 9 0000-0000" />
            </Field>
            <Field className="md:col-span-3" label="WhatsApp">
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 9 0000-0000" />
            </Field>
            <Field className="md:col-span-12" label="Notas / Preferências">
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Ex: gosta de degradê navalhado, barba aparada com tesoura..."
              />
            </Field>
            <div className="md:col-span-12 flex justify-end">
              <Button type="submit" disabled={createMut.isPending} className="bg-gold text-primary-foreground hover:bg-gold/90">
                {createMut.isPending ? "Salvando..." : "Cadastrar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} cliente(s)</span>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum cliente encontrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="group hover:border-gold/40 transition-colors">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border">
                    <User className="h-5 w-5 text-gold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => setDetail(c)}
                      className="font-display text-lg leading-tight truncate text-left hover:text-gold transition-colors"
                    >
                      {c.name}
                    </button>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.phone || "—"}{c.whatsapp && ` · WA: ${c.whatsapp}`}
                    </p>
                    {c.notes && (
                      <p className="text-sm text-muted-foreground mt-3 italic leading-relaxed line-clamp-3">
                        "{c.notes}"
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-4 -mb-1">
                  {c.whatsapp && (
                    <Button
                      size="sm"
                      variant="ghost"
                      asChild
                      className="text-gold hover:text-gold hover:bg-gold/10"
                    >
                      <a
                        href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                      </a>
                    </Button>
                  )}
                  <div className="ml-auto flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleting(c)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Editar cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field className="col-span-2" label="Nome">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="WhatsApp">
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </Field>
            <Field className="col-span-2" label="Notas / Preferências">
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Os lançamentos vinculados a esse cliente serão mantidos, apenas sem vínculo.
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
      <ClientHistoryDialog client={detail} onOpenChange={(o) => !o && setDetail(null)} />
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
