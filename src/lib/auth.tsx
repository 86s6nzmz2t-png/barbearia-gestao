import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "barbeiro";
  status: "pendente" | "aprovado" | "bloqueado";
};

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileError: null,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, status")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setProfileError(error.message);
      return;
    }

    setProfile((data as Profile | null) ?? null);
    setProfileError(data ? null : "Perfil de acesso não encontrado.");
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      // defer profile fetch to avoid deadlocks
      setTimeout(() => {
        loadProfile(s?.user?.id).finally(() => setLoading(false));
      }, 0);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible" && user?.id) {
        void loadProfile(user.id);
      }
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    window.addEventListener("focus", refreshOnReturn);
    return () => {
      document.removeEventListener("visibilitychange", refreshOnReturn);
      window.removeEventListener("focus", refreshOnReturn);
    };
  }, [loadProfile, user?.id]);

  const refreshProfile = async () => {
    await loadProfile(user?.id);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, profileError, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useUserId(): string {
  const { user } = useAuth();
  return user?.id ?? "";
}

export function useIsAdmin(): boolean {
  const { profile } = useAuth();
  return profile?.role === "admin" && profile?.status === "aprovado";
}
