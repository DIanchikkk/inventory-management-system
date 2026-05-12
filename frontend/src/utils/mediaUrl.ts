import { apiBaseUrl } from "../api/http";

function apiLooksLocalhost(): boolean {
  try {
    const host = new URL(apiBaseUrl()).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

/** URL для <img>: `/uploads/...` на API; в dev при локальном API — через proxy Vite (тот же origin). */
export function resolveMediaSrc(url: string | undefined | null): string {
  const u = (url ?? "").trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:") || u.startsWith("blob:")) {
    return u;
  }
  if (import.meta.env.DEV && u.startsWith("/uploads") && apiLooksLocalhost()) {
    return u.startsWith("/") ? u : `/${u}`;
  }
  const base = apiBaseUrl();
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}
