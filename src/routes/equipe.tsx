import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ShieldCheck, ShieldX, UserCog, Users2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/equipe")({
  head: () => ({ meta: [{ title: "Gerenciar Equipe — Barbearia" }] }),
  component: TeamPage,
});

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "barbeiro";
  status: "pendente" | "aprovado" | "bloqueado";
  created_at: string;
};

function TeamPage() {
  const { loading } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/", replace: true });
  }, [loading, isAdmin, navigate]);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles-all"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<ProfileRow, "status" | "role">>;
    }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
      toast.success("Usuário atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.full_name ?? "").toLowerCase().includes(q),
    );
  }, [profiles, search]);

  const counts = useMemo(() => {
    return {
      pendente: profiles.filter((p) => p.status === "pendente").length,
      aprovado: profiles.filter((p) => p.status === "aprovado").length,
      bloqueado: profiles.filter((p) => p.status === "bloqueado").length,
    };
  }, [profiles]);

  if (!isAdmin) return null;

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Controle de Acesso"
        subtitle="Aprove, bloqueie e gerencie as contas da equipe."
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Pendentes" value={counts.pendente} tone="warning" />
        <StatCard label="Aprovados" value={counts.aprovado} tone="success" />
        <StatCard label="Bloqueados" value={counts.bloqueado} tone="danger" />
      </div>

      <div className="mb-4">
        <Input
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <Users2 className="h-6 w-6" />
              Nenhum usuário encontrado.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((p) => (
                <li
                  key={p.id}
                  className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">
                        {p.full_name || p.email || "Sem nome"}
                      </p>
                      <RoleBadge role={p.role} />
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {p.email} · Cadastro{" "}
                      {formatDistanceToNow(new Date(p.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.status !== "aprovado" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          updateMut.mutate({ id: p.id, patch: { status: "aprovado" } })
                        }
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="h-4 w-4 mr-1" /> Aprovar
                      </Button>
                    )}
                    {p.status !== "bloqueado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateMut.mutate({ id: p.id, patch: { status: "bloqueado" } })
                        }
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        <ShieldX className="h-4 w-4 mr-1" /> Bloquear
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateMut.mutate({
                          id: p.id,
                          patch: { role: p.role === "admin" ? "barbeiro" : "admin" },
                        })
                      }
                    >
                      <UserCog className="h-4 w-4 mr-1" />
                      {p.role === "admin" ? "Tornar barbeiro" : "Tornar admin"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "success" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "text-amber-500"
      : tone === "success"
        ? "text-emerald-500"
        : "text-destructive";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`font-display text-2xl mt-1 ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function RoleBadge({ role }: { role: ProfileRow["role"] }) {
  return role === "admin" ? (
    <Badge className="bg-gold/20 text-gold border-gold/30 hover:bg-gold/20">
      <ShieldCheck className="h-3 w-3 mr-1" /> Admin
    </Badge>
  ) : (
    <Badge variant="outline" className="text-xs">
      Barbeiro
    </Badge>
  );
}

function StatusBadge({ status }: { status: ProfileRow["status"] }) {
  if (status === "aprovado")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/15">
        Aprovado
      </Badge>
    );
  if (status === "pendente")
    return (
      <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/15">
        Pendente
      </Badge>
    );
  return (
    <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15">
      Bloqueado
    </Badge>
  );
}
