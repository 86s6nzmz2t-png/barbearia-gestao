import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  LogOut,
  Wallet,
  Users,
  Scissors,
  Settings,
  Heart,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const baseNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/caixa", label: "Caixa", icon: Wallet, exact: false },
  { to: "/clientes", label: "Clientes", icon: Users, exact: false },
  { to: "/fidelizacao", label: "Fidelização", icon: Heart, exact: false },
  { to: "/servicos", label: "Serviços", icon: Scissors, exact: false },
  { to: "/configuracoes", label: "Config", icon: Settings, exact: false },
] as const;

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();


  const isAuthRoute = pathname === "/auth";
  const isPendingRoute = pathname === "/pendente";
  const needsApproval =
    !!user && !!profile && (profile.status === "pendente" || profile.status === "bloqueado");

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthRoute) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (user && needsApproval && !isPendingRoute) {
      navigate({ to: "/pendente", replace: true });
      return;
    }
    if (user && !needsApproval && isPendingRoute) {
      navigate({ to: "/", replace: true });
    }
  }, [loading, user, needsApproval, isAuthRoute, isPendingRoute, navigate]);

  if (isAuthRoute || !user || isPendingRoute || needsApproval) {
    return (
      <>
        <Outlet />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth", replace: true });
  };

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const nav = baseNav;

  return (
    <div className="min-h-screen flex w-full">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="px-6 py-7 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-gradient-to-br from-gold to-gold-muted flex items-center justify-center shadow-lg shadow-gold/10">
              <Scissors className="h-5 w-5 text-primary-foreground" strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg leading-tight text-foreground">Barbearia</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-gold/80 truncate">{user.email}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-sidebar-accent text-foreground border border-gold/30 shadow-inner"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4", active && "text-gold")} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-5 py-3 border-b border-border bg-sidebar/80 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-gold to-gold-muted flex items-center justify-center">
              <Scissors className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-base">Barbearia</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <main className="flex-1 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar/95 backdrop-blur border-t border-sidebar-border">
        <div className="grid grid-cols-6">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                  active ? "text-gold" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <Toaster position="top-right" richColors />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
