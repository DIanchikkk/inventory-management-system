import { createContext } from "react";
import type { User } from "../types";

export type AuthContextValue = {
  user: User | null;
  setUser: (u: User | null) => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
