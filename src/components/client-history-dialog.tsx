import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Repeat, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { brl, paymentLabel } from "@/lib/finance";

type ServiceLine = { id?: string; name: string; price?: number };
type HistoryTx = {
  id: string;
  date: string;
  service: string;
  services: ServiceLine[] | null;
  payment_method: string;
  amount: number;
};

export type HistoryClient = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
};

export function ClientHistoryDialog({
  client,
  onOpenChange,
}: {
  client: HistoryClient | null;
  onOpenChange: (o: boolean) => void;
}) {
  const open = !!client;

  const { data: txs = [], isLoading } = useQuery({
    enabled: open,
    queryKey: ["client-history", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, date, service, services, payment_method, amount")
        .eq("client_id", client!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HistoryTx[];
    },
  });

  const { daysSinceLast, avgReturn, total } = useMemo(() => {
    if (txs.length === 0) return { daysSinceLast: null as number | null, avgReturn: null as number | null, total: 0 };
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const daysSinceLast = differenceInCalendarDays(new Date(), new Date(last.date + "T00:00:00"));
    let avgReturn: number | null = null;
    if (sorted.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        intervals.push(differenceInCalendarDays(
          new Date(sorted[i].date + "T00:00:00"),
          new Date(sorted[i - 1].date + "T00:00:00"),
        ));
      }
      avgReturn = Math.round(intervals.reduce((s, n) => s + n, 0) / intervals.length);
    }
    const total = txs.reduce((s, t) => s + Number(t.amount), 0);
    return { daysSinceLast, avgReturn, total };
  }, [txs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <User className="h-4 w-4 text-gold" /> {client?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            icon={<CalendarClock className="h-4 w-4 text-gold" />}
            label="Última visita"
            value={daysSinceLast === null ? "—" : daysSinceLast === 0 ? "Hoje" : `${daysSinceLast} dia${daysSinceLast === 1 ? "" : "s"}`}
          />
          <MetricCard
            icon={<Repeat className="h-4 w-4 text-gold" />}
            label="Média de retorno"
            value={avgReturn === null ? "—" : `${avgReturn} dia${avgReturn === 1 ? "" : "s"}`}
          />
          <MetricCard
            icon={<span className="text-gold text-xs font-semibold">R$</span>}
            label={`${txs.length} atendimento${txs.length === 1 ? "" : "s"}`}
            value={brl(total)}
          />
        </div>

        <div className="mt-2 max-h-[400px] overflow-y-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Serviços</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : txs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum atendimento registrado.</TableCell></TableRow>
              ) : txs.map((t) => {
                const names = (t.services && t.services.length > 0)
                  ? t.services.map((s) => s.name).join(" + ")
                  : t.service;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(t.date + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{names}</TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground">{paymentLabel(t.payment_method)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-1 rounded bg-gold/15 text-gold border border-gold/30">Pago</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-gold">{brl(Number(t.amount))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 font-display text-lg text-foreground">{value}</p>
    </div>
  );
}
