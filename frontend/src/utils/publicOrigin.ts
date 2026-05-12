export function publicOrigin(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_ORIGIN ?? "").trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
