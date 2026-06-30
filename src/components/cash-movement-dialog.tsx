import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  type: "in" | "out";
  cashSessionId: string | null;
  onOpenChange: (o: boolean) => void;
};

function parseNum(v: string) { return parseFloat(v.replace(",", ".")); }

export function CashMovementDialog({ open, type, cashSessionId, onOpenChange }: Props) {
  const qc = useQueryClient();
  const userId = useUserId();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) { setAmount(""); setDescription(""); }
  }, [open]);

  const isIn = type === "in";
  const title = isIn ? "Adicionar dinheiro (Suprimento)" : "Retirar dinheiro (Sangria)";

  const create = useMutation({
    mutationFn: async () => {
      const value = parseNum(amount);
      if (!value || value <= 0) throw new Error("Informe um valor válido.");
      const { error } = await supabase.from("cash_movements").insert({
        type,
        amount: value,
        description: description.trim(),
        date: format(new Date(), "yyyy-MM-dd"),
        cash_session_id: cashSessionId,
        user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isIn ? "Suprimento registrado" : "Sangria registrada");
      qc.invalidateQueries({ queryKey: ["cash_movements"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {isIn ? <ArrowUpCircle className="h-5 w-5 text-emerald-500" /> : <ArrowDownCircle className="h-5 w-5 text-destructive" />}
            {title}
          </DialogTitle>
          <DialogDescription>
            {isIn ? "Ex: troco extra colocado na gaveta." : "Ex: retirada para compra de produtos."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        >
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Valor (R$)</Label>
            <Input inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Descrição / Motivo</Label>
            <Input placeholder="Descreva o motivo" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              type="submit"
              disabled={create.isPending}
              className={isIn
                ? "bg-emerald-600 text-white hover:bg-emerald-600/90"
                : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {create.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
