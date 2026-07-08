import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/pendente")({
  head: () => ({
    meta: [{ title: "Aguardando aprovação — Barbearia" }],
  }),
  component: PendingPage,
});

function PendingPage() {
  const { profile, refreshProfile, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const handleRefresh = async () => {
    await refreshProfile();
    toast.success("Status atualizado");
  };

  const blocked = profile?.status === "bloqueado";

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12 bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-6 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mb-4">
            {blocked ? (
              <ShieldAlert className="h-7 w-7 text-destructive" />
            ) : (
              <Clock className="h-7 w-7 text-gold" />
            )}
          </div>
          <h1 className="font-display text-2xl text-foreground mb-2">
            {blocked ? "Acesso bloqueado" : "Aguardando aprovação"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {blocked
              ? "Sua conta foi bloqueada pelo administrador. Entre em contato para mais informações."
              : "Sua conta está aguardando a aprovação do administrador. Você receberá o acesso em breve!"}
          </p>
          {user?.email && (
            <p className="text-xs text-muted-foreground mt-4 font-mono">{user.email}</p>
          )}
          <div className="flex flex-col gap-2 mt-8">
            <Button onClick={handleRefresh} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" /> Verificar novamente
            </Button>
            <Button onClick={handleLogout} variant="ghost" className="w-full text-muted-foreground">
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
