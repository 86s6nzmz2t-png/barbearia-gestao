import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Heart, MessageCircle, MessageSquareText, Search, User, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app-shell";
import { brl, paymentLabel } from "@/lib/finance";
import { useSetting } from "@/lib/queries";
import { useUserId } from "@/lib/auth";

const DEFAULT_LOYALTY_MESSAGE =
  "Olá, {nome}! Tudo bem? Notamos que faz mais de 30 dias desde a sua última visita aqui na barbearia para cuidar do visual. Que tal agendar um horário para esta semana?";

export function firstName(fullName: string) {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

export function buildLoyaltyMessage(template: string, clientName: string) {
  return (template || DEFAULT_LOYALTY_MESSAGE).replace(/\{nome\}/gi, firstName(clientName));
}

export const Route = createFileRoute("/fidelizacao")({
  head: () => ({
    meta: [
      { title: "Fidelização — Barbearia" },
      { name: "description", content: "Clientes que não voltam há mais de 30 dias." },
    ],
  }),
  component: FidelizacaoPage,
});

type Client = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
};

type LastTx = { client_id: string; date: string };

function FidelizacaoPage() {
  const [selected, setSelected] = useState<Client | null>(null);
  const [search, setSearch] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const { data: lastByClient = {} } = useQuery({
    queryKey: ["transactions", "last-per-client"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("client_id, date")
        .not("client_id", "is", null)
        .order("date", { ascending: false });
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as LastTx[]) {
        if (row.client_id && !map[row.client_id]) map[row.client_id] = row.date;
      }
      return map;
    },
  });

  const { data: messageTemplate = DEFAULT_LOYALTY_MESSAGE } = useSetting(
    "loyalty_message",
    DEFAULT_LOYALTY_MESSAGE,
  );

  const inactive = useMemo(() => {
    const today = new Date();
    return clients
      .map((c) => {
        const lastDate = lastByClient[c.id];
        const days = lastDate
          ? differenceInCalendarDays(today, new Date(lastDate + "T00:00:00"))
          : null;
        return { client: c, lastDate, days };
      })
      .filter((r) => r.days === null || r.days > 30)
      .sort((a, b) => {
        if (a.days === null && b.days === null) return a.client.name.localeCompare(b.client.name);
        if (a.days === null) return 1;
        if (b.days === null) return -1;
        return b.days - a.days;
      });
  }, [clients, lastByClient]);

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-10 py-8 md:py-12">
      <PageHeader
        title="Fidelização"
        subtitle="Clientes sem visita há mais de 30 dias — chame de volta pelo WhatsApp."
      />

      <SearchClientPanel
        clients={clients}
        lastByClient={lastByClient}
        search={search}
        setSearch={setSearch}
        selected={selected}
        onSelect={(c) => setSelected(c)}
        onClear={() => setSelected(null)}
      />

      <LoyaltyMessageSettings />





      {inactive.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Heart className="h-8 w-8 mx-auto mb-3 text-gold/70" />
            Nenhum cliente sumido por enquanto. Bom trabalho!
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {inactive.map(({ client, lastDate, days }) => {
            const phone = (client.whatsapp || client.phone || "").replace(/\D/g, "");
            const message = buildLoyaltyMessage(messageTemplate, client.name);
            const waUrl = phone
              ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`
              : null;
            return (
              <Card key={client.id} className="group hover:border-gold/40 transition-colors">
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border">
                      <User className="h-5 w-5 text-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <button
                        className="font-display text-lg leading-tight truncate text-left hover:text-gold transition-colors"
                        onClick={() => setSelected(client)}
                      >
                        {client.name}
                      </button>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {client.whatsapp || client.phone || "Sem telefone"}
                      </p>
                      <p className="text-xs mt-2">
                        {days === null ? (
                          <span className="text-muted-foreground italic">Nunca veio</span>
                        ) : (
                          <span className="text-destructive">
                            {days} dias sem visita
                            <span className="text-muted-foreground"> · última {format(new Date(lastDate! + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}</span>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 -mb-1">
                    {waUrl ? (
                      <Button
                        size="sm"
                        asChild
                        className="bg-gold text-primary-foreground hover:bg-gold/90 w-full"
                      >
                        <a href={waUrl} target="_blank" rel="noreferrer">
                          <MessageCircle className="h-4 w-4 mr-1.5" /> Chamar no WhatsApp
                        </a>
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Sem telefone para contato</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}

function SearchClientPanel({
  clients,
  lastByClient,
  search,
  setSearch,
  selected,
  onSelect,
  onClear,
}: {
  clients: Client[];
  lastByClient: Record<string, string>;
  search: string;
  setSearch: (v: string) => void;
  selected: Client | null;
  onSelect: (c: Client) => void;
  onClear: () => void;
}) {
  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const results = q
    ? clients
        .filter((c) => {
          const phones = `${c.phone ?? ""} ${c.whatsapp ?? ""}`.toLowerCase();
          const phoneDigits = phones.replace(/\D/g, "");
          return (
            c.name.toLowerCase().includes(q) ||
            (c.notes ?? "").toLowerCase().includes(q) ||
            phones.includes(q) ||
            (qDigits.length > 0 && phoneDigits.includes(qDigits))
          );
        })
        .slice(0, 8)
    : [];


  return (
    <Card className="mb-6 border-gold/30">
      <CardContent className="pt-5">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente para fidelidade..."
            className="pl-9 h-11"
          />
        </div>
        {q && !selected && (
          <div className="mt-3 divide-y divide-border rounded-md border border-border">
            {results.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground text-center">Nenhum cliente encontrado.</p>
            ) : (
              results.map((c) => {
                const lastDate = lastByClient[c.id];
                const days = lastDate
                  ? differenceInCalendarDays(new Date(), new Date(lastDate + "T00:00:00"))
                  : null;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelect(c);
                      setSearch("");
                    }}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/50 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.whatsapp || c.phone || "Sem telefone"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {days === null ? "Nunca veio" : days === 0 ? "Hoje" : `${days}d`}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
        {selected && <LoyaltyPanel client={selected} onClear={onClear} />}
      </CardContent>
    </Card>
  );
}

type LoyaltyTx = {
  id: string;
  date: string;
  service: string;
  services: { id?: string; name: string; price?: number }[] | null;
  payment_method: string;
  amount: number;
};

function LoyaltyPanel({ client, onClear }: { client: Client; onClear: () => void }) {
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["client-history", client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, date, service, services, payment_method, amount")
        .eq("client_id", client.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LoyaltyTx[];
    },
  });

  const total = txs.length;
  const lastDate = txs[0]?.date ?? null;
  const totalSpent = txs.reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="mt-4 rounded-lg border border-gold/40 bg-gradient-to-br from-gold/5 to-transparent p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-full bg-gold/15 border border-gold/40 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-tight truncate">{client.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {client.whatsapp || client.phone || "Sem telefone"}
          </p>
        </div>
        <button
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Limpar seleção"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <Metric
          icon={<Heart className="h-4 w-4 text-gold" />}
          label="Total de visitas"
          value={isLoading ? "…" : String(total)}
        />
        <Metric
          icon={<CalendarClock className="h-4 w-4 text-gold" />}
          label="Última visita"
          value={
            isLoading
              ? "…"
              : lastDate
                ? format(new Date(lastDate + "T00:00:00"), "dd/MM/yy", { locale: ptBR })
                : "—"
          }
        />
        <Metric
          icon={<span className="text-gold text-xs font-semibold">R$</span>}
          label="Total gasto"
          value={isLoading ? "…" : brl(totalSpent)}
        />
      </div>

      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Histórico rápido
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-3 text-center">Carregando…</p>
        ) : txs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center italic">
            Nenhum atendimento registrado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border max-h-72 overflow-y-auto">
            {txs.map((t) => {
              const names =
                t.services && t.services.length > 0
                  ? t.services.map((s) => s.name).join(" + ")
                  : t.service;
              return (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap w-16">
                    {format(new Date(t.date + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
                  </span>
                  <span className="flex-1 text-sm truncate">{names}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground whitespace-nowrap">
                    {paymentLabel(t.payment_method)}
                  </span>
                  <span className="text-sm tabular-nums text-gold whitespace-nowrap">
                    {brl(Number(t.amount))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 font-display text-lg text-foreground">{value}</p>
    </div>
  );
}

function LoyaltyMessageSettings() {
  const qc = useQueryClient();
  const userId = useUserId();
  const { data: saved } = useSetting("loyalty_message", DEFAULT_LOYALTY_MESSAGE);
  const [text, setText] = useState(DEFAULT_LOYALTY_MESSAGE);

  useEffect(() => {
    if (saved !== undefined) setText(saved);
  }, [saved]);

  const save = useMutation({
    mutationFn: async () => {
      const value = text.trim();
      if (!value) throw new Error("A mensagem não pode ficar vazia");
      const { error } = await supabase
        .from("settings")
        .upsert(
          [{ key: "loyalty_message", value, updated_at: new Date().toISOString(), user_id: userId }],
          { onConflict: "user_id,key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensagem padrão salva");
      qc.invalidateQueries({ queryKey: ["setting", "loyalty_message"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mb-6">
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquareText className="h-4 w-4 text-gold" />
          <p className="font-display text-lg">Mensagem padrão do WhatsApp</p>
        </div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Use {"{nome}"} para inserir o primeiro nome do cliente
        </Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="resize-y"
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="bg-gold text-primary-foreground hover:bg-gold/90"
          >
            Salvar mensagem
          </Button>
          <Button variant="ghost" onClick={() => setText(DEFAULT_LOYALTY_MESSAGE)}>
            Restaurar padrão
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Prévia: {buildLoyaltyMessage(text, "João da Silva")}
        </p>
      </CardContent>
    </Card>
  );
}
