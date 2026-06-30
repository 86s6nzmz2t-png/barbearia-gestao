import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Lock, LockOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { brl } from "@/lib/finance";
import { useTodayCashSession, type CashSession } from "@/lib/queries";

function parseNum(v: string) { return parseFloat(v.replace(",", ".")); }

export function CashSessionBanner({ cashInTotal, movementsNet = 0 }: { cashInTotal: number; movementsNet?: number }) {
  const qc = useQueryClient();
  const userId = useUserId();
  const { data: session, isLoading } = useTodayCashSession();
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [opening, setOpening] = useState("");
  const [counted, setCounted] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cash_session"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const open = useMutation({
    mutationFn: async () => {
      const amount = parseNum(opening) || 0;
      if (amount < 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("cash_sessions").insert({
        date: format(new Date(), "yyyy-MM-dd"),
        opening_amount: amount,
        status: "open",
        user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Caixa aberto"); setOpenDialog(false); setOpening(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: async (s: CashSession) => {
      const countedNum = parseNum(counted);
      if (!Number.isFinite(countedNum)) throw new Error("Informe o valor contado");
      const expected = Number(s.opening_amount) + cashInTotal + movementsNet;
      const diff = countedNum - expected;
      const { error } = await supabase.from("cash_sessions").update({
        counted_amount: countedNum,
        difference: diff,
        status: "closed",
        closed_at: new Date().toISOString(),
      }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Caixa fechado"); setCloseDialog(false); setCounted(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;

  const isOpen = session?.status === "open";
  const expected = session ? Number(session.opening_amount) + cashInTotal + movementsNet : 0;

  return (
    <>
      <Card className={`mb-6 border-l-4 ${isOpen ? "border-l-gold" : "border-l-destructive/60"}`}>
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isOpen ? <LockOpen className="h-5 w-5 text-gold" /> : <Lock className="h-5 w-5 text-destructive" />}
            <div>
              <p className="font-medium text-sm">
                {isOpen ? "Caixa aberto" : session?.status === "closed" ? "Caixa fechado hoje" : "Caixa não aberto"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isOpen
                  ? `Inicial ${brl(Number(session!.opening_amount))} · Esperado em dinheiro: ${brl(expected)}`
                  : session?.status === "closed"
                    ? `Diferença: ${brl(Number(session.difference ?? 0))}`
                    : "Abra o caixa para liberar os lançamentos."}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!session || session.status === "closed" ? (
              <Button onClick={() => setOpenDialog(true)} className="bg-gold text-primary-foreground hover:bg-gold/90">
                Abrir caixa
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setCloseDialog(true)}>Fechar caixa</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Abrir caixa</DialogTitle>
            <DialogDescription>Informe o valor inicial em dinheiro (troco na gaveta).</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Valor inicial (R$)</Label>
            <Input inputMode="decimal" placeholder="0,00" value={opening} onChange={(e) => setOpening(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button className="bg-gold text-primary-foreground hover:bg-gold/90" disabled={open.isPending} onClick={() => open.mutate()}>
              Abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Fechamento de caixa</DialogTitle>
            <DialogDescription>Confira os valores e informe o que está fisicamente na gaveta.</DialogDescription>
          </DialogHeader>
          {session && (
            <div className="space-y-3 text-sm">
              <Row label="Valor inicial" value={brl(Number(session.opening_amount))} />
              <Row label="Entradas em dinheiro" value={brl(cashInTotal)} />
              <Row label="Suprimentos / Sangrias" value={brl(movementsNet)} />
              <Row label="Esperado na gaveta" value={brl(expected)} strong />
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Valor físico contado (R$)</Label>
                <Input inputMode="decimal" placeholder="0,00" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
              </div>
              {counted && Number.isFinite(parseNum(counted)) && (
                <DiffPreview diff={parseNum(counted) - expected} />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseDialog(false)}>Cancelar</Button>
            <Button
              className="bg-gold text-primary-foreground hover:bg-gold/90"
              disabled={close.isPending}
              onClick={() => session && close.mutate(session)}
            >Confirmar fechamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${strong ? "text-gold font-display text-lg" : ""}`}>{value}</span>
    </div>
  );
}

function DiffPreview({ diff }: { diff: number }) {
  const rounded = Math.round(diff * 100) / 100;
  if (rounded === 0) {
    return <p className="text-sm text-gold flex items-center gap-2">✓ Caixa bateu certinho.</p>;
  }
  return (
    <p className={`text-sm flex items-center gap-2 ${rounded > 0 ? "text-gold" : "text-destructive"}`}>
      <AlertTriangle className="h-4 w-4" />
      {rounded > 0 ? `Sobrou ${brl(rounded)}` : `Faltou ${brl(Math.abs(rounded))}`}
    </p>
  );
}

export function useCashSessionGate() {
  const { data: session } = useTodayCashSession();
  return { isOpen: session?.status === "open", session };
}
