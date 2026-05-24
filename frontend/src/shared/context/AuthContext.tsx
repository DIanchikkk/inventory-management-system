import { useCallback, useMemo, useState, type ReactNode } from "react";
import { fetchMe } from "@/shared/api/auth.api";
import { getToken } from "@/shared/api/token";
import type { User } from "@/shared/types";
import { AuthContext } from "./auth.context";

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
