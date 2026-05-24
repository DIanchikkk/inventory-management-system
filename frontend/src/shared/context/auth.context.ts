import { createContext } from "react";
import type { User } from "@/shared/types";

export type AuthContextValue = {
  user: User | null;
  setUser: (u: User | null) => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
