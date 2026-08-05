import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listUserAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("role, status")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (profile?.role !== "admin" || profile.status !== "aprovado") {
      throw new Error("Apenas administradores podem visualizar contas.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    userId: string;
    status?: "pendente" | "aprovado" | "bloqueado";
    role?: "admin" | "barbeiro";
  }) => {
    if (!input?.userId || (!input.status && !input.role)) throw new Error("Alteração inválida");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("role, status")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (profile?.role !== "admin" || profile.status !== "aprovado") {
      throw new Error("Apenas administradores podem alterar acessos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { status?: "pendente" | "aprovado" | "bloqueado"; role?: "admin" | "barbeiro" } = {};
    if (data.status) patch.status = data.status;
    if (data.role) patch.role = data.role;
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId || typeof input.userId !== "string") {
      throw new Error("userId inválido");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("role, status")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (profile?.role !== "admin" || profile.status !== "aprovado") {
      throw new Error("Apenas administradores podem excluir contas.");
    }
    if (data.userId === context.userId) throw new Error("Você não pode excluir sua própria conta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
