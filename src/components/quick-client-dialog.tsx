import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export type QuickClient = { id: string; name: string };

export function QuickClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (client: QuickClient) => void;
}) {
  const userId = useUserId();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setWhatsapp("");
      setNotes("");
    }
  }, [open]);

  const createMut = useMutation({
    mutationFn: async () => {
      const n = name.trim();
      if (!n) throw new Error("Nome é obrigatório.");
      const p = phone.trim() || null;
      const w = whatsapp.trim() || p;
      const { data, error } = await supabase
        .from("clients")
        .insert({
          name: n,
          phone: p,
          whatsapp: w,
          notes: notes.trim() || null,
          user_id: userId,
        })
        .select("id, name")
        .single();
      if (error) throw error;
      return data as QuickClient;
    },
    onSuccess: (c) => {
      toast.success("Cliente cadastrado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      onCreated(c);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Novo cliente</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}
        >
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Nome</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 9 0000-0000" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">WhatsApp</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 9 0000-0000" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Notas / Preferências</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: gosta de degradê navalhado"
            />
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              type="submit"
              disabled={createMut.isPending}
              className="bg-gold text-primary-foreground hover:bg-gold/90"
            >
              {createMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
