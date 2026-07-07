import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Heart, MessageCircle, Search, User, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app-shell";
import { ClientHistoryDialog, type HistoryClient } from "@/components/client-history-dialog";

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
  const [detail, setDetail] = useState<HistoryClient | null>(null);
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
        onSelect={(c) => setDetail(c)}
      />



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
            const message = `Olá ${client.name}, tudo bem? Notamos que faz mais de 30 dias desde a sua última visita aqui na barbearia para cuidar do visual. Que tal agendar um horário para esta semana?`;
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
                        onClick={() => setDetail(client)}
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

      <ClientHistoryDialog client={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}

function SearchClientPanel({
  clients,
  lastByClient,
  search,
  setSearch,
  onSelect,
}: {
  clients: Client[];
  lastByClient: Record<string, string>;
  search: string;
  setSearch: (v: string) => void;
  onSelect: (c: Client) => void;
}) {
  const q = search.trim().toLowerCase();
  const results = q
    ? clients
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.phone ?? "").toLowerCase().includes(q) ||
            (c.whatsapp ?? "").toLowerCase().includes(q),
        )
        .slice(0, 8)
    : [];

  return (
    <Card className="mb-6">
      <CardContent className="pt-5">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente por nome ou telefone para ver histórico de fidelidade..."
            className="pl-9"
          />
        </div>
        {q && (
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
      </CardContent>
    </Card>
  );
}

