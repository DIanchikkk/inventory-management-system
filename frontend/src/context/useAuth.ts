import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./auth.context";

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
