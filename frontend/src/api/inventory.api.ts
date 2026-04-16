import type { InventoryResult, InventorySession, InventorySessionDetail } from "../types";
import { http } from "./http";

export async function createSession(): Promise<InventorySession> {
  const { data } = await http.post<InventorySession>("/inventory/sessions");
  return data;
}

export async function fetchSessions(): Promise<InventorySession[]> {
  const { data } = await http.get<InventorySession[]>("/inventory/sessions");
  return data;
}

export async function fetchSessionDetail(id: string): Promise<InventorySessionDetail> {
  const { data } = await http.get<InventorySessionDetail>(`/inventory/sessions/${id}`);
  return data;
}

/** Одна строка результата (как в спецификации POST .../results). */
export async function postSessionResult(
  sessionId: string,
  body: { item_id: string; actual_quantity: number },
): Promise<InventoryResult> {
  const { data } = await http.post<InventoryResult>(`/inventory/sessions/${sessionId}/results`, body);
  return data;
}

export async function postSessionResultsBatch(
  sessionId: string,
  rows: { item_id: string; actual_quantity: number }[],
): Promise<InventoryResult[]> {
  const { data } = await http.post<InventoryResult[]>(
    `/inventory/sessions/${sessionId}/results/batch`,
    rows,
  );
  return data;
}

export async function completeSession(sessionId: string): Promise<InventorySession> {
  const { data } = await http.post<InventorySession>(`/inventory/sessions/${sessionId}/complete`);
  return data;
}
