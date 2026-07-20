import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "student";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  identifier: string; // username for admin, code for student
}

interface AuthState {
  user: User | null;
  role: AppRole | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function loadRoleAndProfile(user: User): Promise<{ role: AppRole | null; profile: Profile | null }> {
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (roleRow?.role ?? null) as AppRole | null;

  let profile: Profile | null = null;
  if (role === "admin") {
    const { data } = await supabase
      .from("admins")
      .select("id, full_name, avatar_url, username")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) profile = { id: data.id, full_name: data.full_name, avatar_url: data.avatar_url, identifier: data.username };
  } else if (role === "student") {
    const { data } = await supabase
      .from("students")
      .select("id, full_name, avatar_url, code")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) profile = { id: data.id, full_name: data.full_name, avatar_url: data.avatar_url, identifier: data.code };
  }
  return { role, profile };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUser = async (u: User | null) => {
    if (!u) {
      setUser(null); setRole(null); setProfile(null); return;
    }
    setUser(u);
    const { role: r, profile: p } = await loadRoleAndProfile(u);
    setRole(r); setProfile(p);
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    await applyUser(data.user);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setRole(null); setProfile(null);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      await applyUser(data.user);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      // Defer so we don't call other supabase methods synchronously inside the callback
      setTimeout(() => { applyUser(session?.user ?? null); }, 0);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
