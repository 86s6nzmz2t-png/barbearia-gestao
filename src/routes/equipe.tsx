import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth, useIsAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { UserAccessSection } from "@/components/user-access-section";

export const Route = createFileRoute("/equipe")({
  head: () => ({
    meta: [
      { title: "Gerenciar Equipe — Barbearia" },
      { name: "description", content: "Aprove, recuse e gerencie os acessos da equipe." },
      { property: "og:title", content: "Gerenciar Equipe — Barbearia" },
      { property: "og:description", content: "Aprove, recuse e gerencie os acessos da equipe." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { loading } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/", replace: true });
  }, [loading, isAdmin, navigate]);

  if (!isAdmin) return null;

  return (
    <div className="max-w-5xl mx-auto p-5 md:p-8">
      <PageHeader
        title="Controle de Acesso"
        subtitle="Aprove, recuse, suspenda e exclua contas da equipe."
      />
      <UserAccessSection />
    </div>
  );
}
