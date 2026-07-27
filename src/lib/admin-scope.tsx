import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Global admin scope — a class + group filter shared across every admin page
 * (students, leaderboard, results, reports, messaging targets…). Set from
 * the header dropdowns; persisted in localStorage so it survives reloads.
 *
 * Individual pages still expose their own class/group selects: the global
 * scope seeds those selects, but the user can override on the page.
 */
export type AdminScope = { classId: string | null; groupId: string | null };

type Ctx = AdminScope & {
  setClassId: (id: string | null) => void;
  setGroupId: (id: string | null) => void;
  clear: () => void;
};

const STORAGE_KEY = "admin.scope.v1";
const ScopeCtx = createContext<Ctx | null>(null);

function readInitial(): AdminScope {
  if (typeof window === "undefined") return { classId: null, groupId: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { classId: null, groupId: null };
    const p = JSON.parse(raw);
    return { classId: p.classId ?? null, groupId: p.groupId ?? null };
  } catch { return { classId: null, groupId: null }; }
}

export function AdminScopeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminScope>(readInitial);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const setClassId = useCallback((id: string | null) => {
    // changing class always clears the group (groups belong to a class)
    setState({ classId: id, groupId: null });
  }, []);
  const setGroupId = useCallback((id: string | null) => {
    setState((s) => ({ ...s, groupId: id }));
  }, []);
  const clear = useCallback(() => setState({ classId: null, groupId: null }), []);

  const value = useMemo<Ctx>(() => ({ ...state, setClassId, setGroupId, clear }), [state, setClassId, setGroupId, clear]);
  return <ScopeCtx.Provider value={value}>{children}</ScopeCtx.Provider>;
}

export function useAdminScope(): Ctx {
  const v = useContext(ScopeCtx);
  if (!v) return { classId: null, groupId: null, setClassId: () => {}, setGroupId: () => {}, clear: () => {} };
  return v;
}
