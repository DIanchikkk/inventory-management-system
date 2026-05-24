import type { LoginResponse, User } from "@/shared/types";
import { http } from "./http";
import { setToken } from "./token";

export function logout(): void {
  setToken(null);
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await http.post<LoginResponse>("/auth/login", { username, password });
  setToken(data.token);
  return data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await http.get<User>("/auth/me");
  return data;
}
