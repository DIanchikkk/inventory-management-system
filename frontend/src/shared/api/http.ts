import axios, { type AxiosError } from "axios";
import { ApiError } from "@/shared/utils/errors";
import { getToken } from "./token";

export function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
  return raw.replace(/\/+$/, "");
}

export const http = axios.create({
  baseURL: apiBaseUrl(),
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  if (config.data instanceof FormData && config.headers && typeof config.headers === "object") {
    delete (config.headers as Record<string, unknown>)["Content-Type"];
  }
  return config;
});

function networkHint(): string {
  const base = apiBaseUrl();
  return `Нет связи с API (${base}). Запустите бэкенд, проверьте VITE_API_URL во frontend/.env и перезапустите Vite; для доступа по LAN на API нужен CORS_ALLOW_LAN=1.`;
}

http.interceptors.response.use(
  (response) => response,
  (err: AxiosError<{ error?: string }>) => {
    const res = err.response;
    if (res) {
      const msg = res.data?.error ?? res.statusText ?? "Ошибка запроса";
      return Promise.reject(new ApiError(res.status, msg, res.data));
    }
    const raw = (err.message ?? "").toLowerCase();
    const isNet =
      err.code === "ERR_NETWORK" ||
      raw.includes("network error") ||
      raw.includes("failed to fetch") ||
      err.code === "ECONNABORTED";
    const msg = isNet ? networkHint() : (err.message ?? "Сеть недоступна");
    return Promise.reject(new ApiError(0, msg, undefined));
  },
);
