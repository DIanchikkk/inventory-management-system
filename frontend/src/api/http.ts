import axios, { type AxiosError } from "axios";
import { ApiError } from "../utils/errors";
import { getToken } from "./token";

function apiBaseUrl(): string {
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
  return config;
});

function networkHint(): string {
  const base = apiBaseUrl();
  return [
    "Сервер API недоступен (запрос не дошёл до ответа).",
    `Проверьте: 1) запущен ли бэкенд (например curl ${base}/health);`,
    "2) во frontend/.env указано VITE_API_URL=" + base.split("?")[0] + " без лишнего слэша в конце;",
    "3) после изменения .env перезапустите npm run dev.",
    "Если открываете сайт не с localhost (другой IP/порт) — добавьте этот origin в CORS_ORIGINS на бэкенде.",
  ].join(" ");
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
