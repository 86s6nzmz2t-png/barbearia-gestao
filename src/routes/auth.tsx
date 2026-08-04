import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Scissors } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Barbearia" },
      { name: "description", content: "Acesse sua barbearia ou crie uma conta." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada! Aguarde a aprovação de um administrador para acessar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-md bg-gradient-to-br from-gold to-gold-muted flex items-center justify-center shadow-lg shadow-gold/20 mb-4">
            <Scissors className="h-7 w-7 text-primary-foreground" strokeWidth={2.4} />
          </div>
          <h1 className="font-display text-3xl text-foreground">Barbearia</h1>
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold/80 mt-1">Gestão Premium</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2 mb-6 p-1 rounded-md bg-muted/40">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 py-2 text-sm rounded font-medium transition ${
                  mode === "login" ? "bg-gold text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 py-2 text-sm rounded font-medium transition ${
                  mode === "signup" ? "bg-gold text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Criar conta
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">E-mail</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Senha</Label>
                <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-gold text-primary-foreground hover:bg-gold/90">
                {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar minha barbearia"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Seus dados ficam isolados e protegidos por conta.
        </p>
      </div>
    </div>
  );
}
