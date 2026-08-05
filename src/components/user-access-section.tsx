import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ShieldCheck, ShieldX, Trash2, UserCog, Users2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/lib/auth";
import { deleteUserAccount } from "@/lib/admin-users.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "barbeiro";
  status: "pendente" | "aprovado" | "bloqueado";
  created_at: string;
};

export function UserAccessSection() {
  const isAdmin = useIsAdmin();
  const { user, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const qc = useQueryClient();
  const removeAccount = useServerFn(deleteUserAccount);

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

  const deleteMut = useMutation({
    mutationFn: async (id: string) => removeAccount({ data: { userId: id } }),
    onSuccess: () => {
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
      toast.success("Conta excluída");
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

  const counts = useMemo(
    () => ({
      pendente: profiles.filter((p) => p.status === "pendente").length,
      aprovado: profiles.filter((p) => p.status === "aprovado").length,
      bloqueado: profiles.filter((p) => p.status === "bloqueado").length,
    }),
    [profiles],
  );

  if (authLoading || !isAdmin) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users2 className="h-4 w-4 text-gold" /> Gerenciamento de Acessos
        </CardTitle>
        <div className="flex gap-2 text-[11px]">
          <span className="text-amber-500">{counts.pendente} pendentes</span>
          <span className="text-emerald-500">{counts.aprovado} aprovados</span>
          <span className="text-destructive">{counts.bloqueado} suspensos</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {filtered.map((p) => (
              <li key={p.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {p.email ?? p.full_name ?? "Sem e-mail"}
                    </p>
                    <RoleBadge role={p.role} />
                    <StatusBadge status={p.status} />
                    {p.id === user?.id && (
                      <Badge variant="outline" className="text-[10px]">
                        Você
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.full_name ? `${p.full_name} · ` : ""}Cadastro{" "}
                    {formatDistanceToNow(new Date(p.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>

                {confirmId === p.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Excluir definitivamente?</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      disabled={deleteMut.isPending}
                      onClick={() => deleteMut.mutate(p.id)}
                    >
                      Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {p.status === "pendente" && (
                      <>
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() =>
                            updateMut.mutate({ id: p.id, patch: { status: "aprovado" } })
                          }
                        >
                          <Check className="mr-1 h-4 w-4" /> Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            updateMut.mutate({ id: p.id, patch: { status: "bloqueado" } })
                          }
                        >
                          <ShieldX className="mr-1 h-4 w-4" /> Recusar
                        </Button>
                      </>
                    )}

                    {p.status === "aprovado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          updateMut.mutate({ id: p.id, patch: { status: "bloqueado" } })
                        }
                      >
                        <ShieldX className="mr-1 h-4 w-4" /> Suspender
                      </Button>
                    )}

                    {p.status === "bloqueado" && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() =>
                          updateMut.mutate({ id: p.id, patch: { status: "aprovado" } })
                        }
                      >
                        <Check className="mr-1 h-4 w-4" /> Reativar
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
                      <UserCog className="mr-1 h-4 w-4" />
                      {p.role === "admin" ? "Tornar barbeiro" : "Tornar admin"}
                    </Button>

                    {p.id !== user?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmId(p.id)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Excluir
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RoleBadge({ role }: { role: ProfileRow["role"] }) {
  return role === "admin" ? (
    <Badge className="bg-gold/20 text-gold border-gold/30 hover:bg-gold/20">
      <ShieldCheck className="mr-1 h-3 w-3" /> Admin
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
      Recusado / Suspenso
    </Badge>
  );
}
