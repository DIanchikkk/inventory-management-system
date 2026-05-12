import type { Item } from "../types";

export type DiscrepancyKind = "match" | "mismatch" | "missing" | "pending";

export type SessionRowTone = "success" | "error" | "warning" | "neutral";

export function sessionRowTone(kind: DiscrepancyKind): SessionRowTone {
  if (kind === "match") return "success";
  if (kind === "missing") return "error";
  if (kind === "mismatch") return "warning";
  return "neutral";
}

export function effectiveActualQuantity(
  draft: string | undefined,
  savedActual: number | undefined,
  savedStatus?: string,
): number | null {
  if (draft !== undefined && draft !== "") {
    const n = Number.parseInt(draft, 10);
    if (!Number.isNaN(n)) return n;
  }
  if (savedStatus === "pending") return null;
  if (savedActual !== undefined) return savedActual;
  return null;
}

export function quantityDelta(item: Item, actual: number | null): number | null {
  if (actual === null) return null;
  return actual - item.quantity;
}

export function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : String(delta);
}

export function computeDiscrepancy(expected: number, actual: number): DiscrepancyKind {
  if (actual === expected) return "match";
  if (actual === 0 && expected > 0) return "missing";
  return "mismatch";
}

export function sessionRowStatus(
  item: Item,
  draft: string | undefined,
  saved: string | undefined,
): DiscrepancyKind {
  if (draft !== undefined && draft !== "") {
    const n = Number.parseInt(draft, 10);
    if (!Number.isNaN(n)) return computeDiscrepancy(item.quantity, n);
  }
  if (saved === "match" || saved === "mismatch" || saved === "missing" || saved === "pending") return saved;
  return "pending";
}

export function sessionStatusLabel(status: string): string {
  if (status === "active") return "Активна";
  if (status === "review") return "На проверке";
  if (status === "completed") return "Завершена";
  if (status === "archived") return "В архиве";
  if (status === "draft") return "Черновик";
  return status;
}
