import { apiBaseUrl } from "@/shared/api/http";

function apiLooksLocalhost(): boolean {
  try {
    const host = new URL(apiBaseUrl()).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

function withCacheBuster(url: string, cacheKey?: string): string {
  const key = (cacheKey ?? "").trim();
  if (!key) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(key)}`;
}

/** URL для <img>: `/uploads/...` на API; в dev при локальном API — через proxy Vite (тот же origin). */
export function resolveMediaSrc(url: string | undefined | null, cacheKey?: string): string {
  const u = (url ?? "").trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:") || u.startsWith("blob:")) {
    return withCacheBuster(u, cacheKey);
  }
  if (import.meta.env.DEV && u.startsWith("/uploads") && apiLooksLocalhost()) {
    const rel = u.startsWith("/") ? u : `/${u}`;
    return withCacheBuster(rel, cacheKey);
  }
  const base = apiBaseUrl();
  const full = u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
  return withCacheBuster(full, cacheKey);
}
