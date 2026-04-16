import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { fetchMe } from "../api/auth.api";
import { getToken } from "../api/token";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  setUser: (u: User | null) => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      setUser(await fetchMe());
    } catch {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      refreshUser,
      isAdmin: user?.role === "admin",
    }),
    [user, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
